import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { ENV, GEMINI_MODEL, SKIP_GEMINI_PROMPTS } from '../../../../lib/env'
import { 
  badRequest, 
  serverError, 
  ok,
  tooManyRequests,
} from '../../../../lib/http'
import { logApiCall, logError } from '../../../../lib/log'
import { getRequestId } from '../../../../lib/context'
import { getClientIP, isPromptRateLimited } from '../../../../lib/rateLimit'
import { PrepPathSchema, type PrepPath } from '../../../../lib/guided/types'

export const runtime = 'nodejs'

// Request schema
const PlanRequestSchema = z.object({
  job_description: z.string().min(1).max(10000),
  resume_text: z.string().max(5000).optional(),
})

function buildPlanPrompt(jobDescription: string, resumeText?: string): string {
  const resumeContext = resumeText 
    ? `\n\nOptional resume context (use to tailor signals, but focus on JD requirements):\n${resumeText.substring(0, 1000)}`
    : '';

  return `You are an interview prep coach that creates structured practice paths from job descriptions.

Your task: Analyze the job description and generate a PrepPath with:
1. 5-7 key signals (what the role values) - each signal MUST include evidence (specific JD phrases)
2. A 2-module practice sequence: Signal Map → Coach Rep

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Just the raw JSON object.

Required JSON schema:
{
  "title": "Short prep path title (e.g., 'Senior Engineer Interview Prep')",
  "objective": "One sentence describing the goal",
  "signals": [
    {
      "id": "signal-1",
      "label": "Signal name (e.g., 'Technical depth in distributed systems')",
      "evidence": ["exact JD phrase 1", "exact JD phrase 2", "exact JD phrase 3"]
    },
    // ... 4-6 more signals (total 5-7)
  ],
  "modules": [
    {
      "type": "signal_map",
      "goal": "Goal for signal selection module",
      "signals": [
        // Same signals array as above (5-7 signals)
      ]
    },
    {
      "type": "coach_rep",
      "goal": "Goal for practice rep (e.g., 'Practice articulating technical depth')",
      "prompt": "Specific question/prompt for the user to answer (tailored to selected signals)",
      "constraints": {
        "time_limit_sec": 120,
        "rubric_focus": "structure"
      },
      "success_criteria": "What success looks like"
    }
  ]
}

Guidelines:
- Extract 5-7 signals that are MOST relevant to the role
- Each signal MUST have evidence array with 2-4 exact phrases from the JD (copy them verbatim)
- Signals should cover: technical skills, communication style, problem-solving approach, leadership, domain expertise
- Coach Rep prompt should be a realistic interview question that tests the selected signals
- Rubric focus should be one of: "clarity", "structure", "specificity"
- Keep all text concise and actionable

Job Description:
"""
${jobDescription}
"""${resumeContext}`;
}

function tryParseJson(raw: string): unknown | null {
  // First try direct parsing
  try {
    return JSON.parse(raw);
  } catch {}
  
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1] as string);
    } catch {}
  }
  
  // Try to find JSON object in the text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  
  // Try to clean up common issues and parse again
  const cleaned = raw
    .replace(/^[^{]*/, '') // Remove text before first {
    .replace(/[^}]*$/, '') // Remove text after last }
    .trim();
  
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      return JSON.parse(cleaned);
    } catch {}
  }
  
  return null;
}

function createFallbackPlan(jobDescription: string): PrepPath {
  // Simple fallback: extract a few generic signals
  const signals = [
    {
      id: 'signal-1',
      label: 'Technical competence',
      evidence: ['technical', 'skills', 'experience'],
    },
    {
      id: 'signal-2',
      label: 'Communication clarity',
      evidence: ['communication', 'collaboration', 'team'],
    },
    {
      id: 'signal-3',
      label: 'Problem-solving ability',
      evidence: ['problem', 'solve', 'challenge'],
    },
    {
      id: 'signal-4',
      label: 'Domain expertise',
      evidence: ['experience', 'knowledge', 'background'],
    },
    {
      id: 'signal-5',
      label: 'Leadership potential',
      evidence: ['lead', 'manage', 'mentor'],
    },
  ];

  return {
    title: 'Interview Prep Path',
    objective: 'Prepare for your interview by focusing on key signals and practicing your responses.',
    signals,
    modules: [
      {
        type: 'signal_map',
        goal: 'Select the top 3 signals you want to emphasize in your interview',
        signals,
      },
      {
        type: 'coach_rep',
        goal: 'Practice articulating your experience with clarity and structure',
        prompt: 'Tell me about a time when you solved a challenging technical problem.',
        constraints: {
          time_limit_sec: 120,
          rubric_focus: 'structure',
        },
        success_criteria: 'Clear structure (Context → Action → Result) with concrete examples',
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId() || 'unknown'
  const startTime = Date.now()
  
  try {
    // Validate content type
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      logError('Invalid content type', { contentType, requestId })
      return badRequest('Expected application/json', 'INVALID_CONTENT_TYPE', requestId)
    }

    // Parse and validate request body
    const body = await req.json()
    const parsed = PlanRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      return badRequest(`Validation failed: ${issues}`, 'VALIDATION_ERROR', requestId)
    }

    const { job_description, resume_text } = parsed.data

    // Rate limiting
    const ip = getClientIP(req)
    if (isPromptRateLimited(ip)) {
      logApiCall('PlanGeneration', 'rate_limited', 429, Date.now() - startTime, requestId)
      return tooManyRequests('Too many requests', 'RATE_LIMITED', requestId)
    }

    // Skip Gemini if SKIP_GEMINI_PROMPTS is enabled (for local testing)
    if (SKIP_GEMINI_PROMPTS) {
      const fallbackPlan = createFallbackPlan(job_description)
      return ok(fallbackPlan, requestId)
    }

    // Generate plan with Gemini
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

    try {
      const promptText = buildPlanPrompt(job_description, resume_text)
      
      const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY })
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: promptText,
      })
      
      clearTimeout(timeoutId)
      
      const rawText = result.text || ''
      
      // Parse JSON
      let parsedJson: unknown | null = null
      try {
        parsedJson = tryParseJson(rawText.trim())
      } catch (parseError) {
        logError('JSON parse failed', { error: parseError, requestId, rawTextPreview: rawText.substring(0, 500) })
      }

      logApiCall('Gemini', GEMINI_MODEL, 200, Date.now() - startTime, requestId)

      if (parsedJson && typeof parsedJson === 'object') {
        // Validate with Zod schema
        const validation = PrepPathSchema.safeParse(parsedJson)
        if (validation.success) {
          return ok(validation.data, requestId)
        } else {
          logError('Response validation failed', { errors: validation.error.issues, requestId, parsedJson })
          // Fall through to fallback
        }
      }

      // Fall through to fallback if Gemini response invalid
    } catch (error) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      if (error instanceof Error && error.name === 'AbortError') {
        logApiCall('Gemini', 'timeout', 408, duration, requestId, { error: 'Request timeout' })
        // Fall through to fallback
      } else {
        logError('Gemini API error', { 
          error: error instanceof Error ? error.message : 'Unknown error', 
          duration, 
          requestId 
        })
        // Fall through to fallback
      }
    }

    // Fallback: return simple plan
    const fallbackPlan = createFallbackPlan(job_description)
    return ok(fallbackPlan, requestId)
    
  } catch (error) {
    const duration = Date.now() - startTime
    logError('Plan generation endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      duration, 
      requestId 
    })
    return serverError('Plan generation failed', 'INTERNAL_ERROR', requestId)
  }
}
