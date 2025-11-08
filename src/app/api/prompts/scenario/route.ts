import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { ENV } from '../../../../lib/env'
import { 
  badRequest, 
  serverError, 
  ok,
  tooManyRequests,
} from '../../../../lib/http'
import { logApiCall, logError } from '../../../../lib/log'
import { getRequestId } from '../../../../lib/context'
import { getClientIP, isPromptRateLimited } from '../../../../lib/rateLimit'
import { detectCategoryFromScenario, type PromptCategory } from '../../../../lib/keywordMapper'

export const runtime = 'nodejs'

// In-flight request map for idempotency
const inFlightRequests = new Map<string, Promise<unknown>>()

// Zod schemas
const ScenarioRequestSchema = z.object({
  scenario: z.string().min(1).max(500),
  intent: z.enum(['decisive', 'natural', 'calm', 'persuasive', 'empathetic']).optional(),
  idempotencyKey: z.string().optional(),
})

const PromptSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
})

const ScenarioResponseSchema = z.object({
  prompts: z.array(PromptSchema).length(3),
  source: z.enum(['gemini', 'fallback']),
})

type Prompt = z.infer<typeof PromptSchema>

// Category icon mapping (from record/page.tsx)
const CATEGORY_ICON: Record<string, string> = {
  Clarity: "🔍",
  Authority: "🏆",
  Calmness: "🌊",
  Engagement: "✨",
  Impact: "🚀",
  Wildcard: "🎲",
}

// Fallback prompt library (refactored from buildPrompts)
function getFallbackPrompts(category: PromptCategory): Prompt[] {
  if (category === "jobSeeker") {
    return [
      { id: "js-clarity-1", title: "Walk me through your resume in under a minute.", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "js-authority-1", title: "Why should we hire you over other candidates?", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "js-calm-1", title: "Tell me about yourself.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
    ];
  }
  if (category === "productManager") {
    return [
      { id: "pm-clarity-1", title: "What's the problem your team is solving right now?", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "pm-authority-1", title: "What's your recommendation for next quarter and why?", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "pm-calm-1", title: "Give us a quick status update on your project.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
    ];
  }
  // surprise / have fun
  return [
    { id: "fun-clarity-1", title: "Explain TikTok to your grandma in 30 seconds.", category: "Clarity", icon: CATEGORY_ICON.Clarity },
    { id: "fun-authority-1", title: "Convince me why pineapple does (or doesn't) belong on pizza.", category: "Authority", icon: CATEGORY_ICON.Authority },
    { id: "fun-calm-1", title: "Describe your perfect weekend as if you're narrating a calm podcast.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
  ];
}

function buildGeminiPrompt(scenario: string, intent?: string): string {
  const intentContext = intent 
    ? `The user wants to sound ${intent} in this scenario.`
    : '';

  return `You are a communication coach that generates practice prompts for real-world scenarios.

Your task: Generate exactly 3 practice prompts for the user's scenario. Each prompt should be:
- Specific to their scenario
- Actionable and realistic
- Concise (under 15 words)
- Safe and appropriate for professional contexts

${intentContext}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Just the raw JSON object.

Required JSON schema:
{
  "prompts": [
    {
      "id": "unique-id-1",
      "title": "First practice prompt question",
      "subtitle": "Optional context or tip",
      "category": "Clarity|Authority|Calmness|Engagement|Impact",
      "icon": "🔍"
    },
    {
      "id": "unique-id-2",
      "title": "Second practice prompt question",
      "subtitle": "Optional context or tip",
      "category": "Clarity|Authority|Calmness|Engagement|Impact",
      "icon": "🏆"
    },
    {
      "id": "unique-id-3",
      "title": "Third practice prompt question",
      "subtitle": "Optional context or tip",
      "category": "Clarity|Authority|Calmness|Engagement|Impact",
      "icon": "🌊"
    }
  ]
}

Guidelines:
- Each prompt should be a direct question or instruction the user can practice answering
- Make prompts relevant to the specific scenario provided
- Use appropriate categories (Clarity, Authority, Calmness, Engagement, Impact)
- Icons should match categories: 🔍 Clarity, 🏆 Authority, 🌊 Calmness, ✨ Engagement, 🚀 Impact
- Ensure all strings are properly quoted and escaped
- Generate unique IDs (e.g., "scenario-1", "scenario-2", "scenario-3")

User's scenario:
"""
${scenario}
"""`;
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
    const parsed = ScenarioRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      return badRequest(`Validation failed: ${issues}`, 'VALIDATION_ERROR', requestId)
    }

    const { scenario, intent, idempotencyKey } = parsed.data

    // Check idempotency
    if (idempotencyKey) {
      const existing = inFlightRequests.get(idempotencyKey)
      if (existing) {
        // Return the existing promise result
        try {
          const result = await existing
          return ok(result, requestId)
        } catch (error) {
          // If existing request failed, continue with new request
          inFlightRequests.delete(idempotencyKey)
        }
      }
    }

    // Rate limiting
    const ip = getClientIP(req)
    if (isPromptRateLimited(ip)) {
      logApiCall('PromptGeneration', 'rate_limited', 429, Date.now() - startTime, requestId)
      return tooManyRequests('Too many requests', 'RATE_LIMITED', requestId)
    }

    // Analytics will be tracked client-side

    // Create request promise for idempotency
    const requestPromise = (async () => {
      // Try Gemini first
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

      try {
        const promptText = buildGeminiPrompt(scenario, intent)
        console.log('🤖 Calling Gemini with scenario:', scenario, 'intent:', intent)
        
        const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY })
        const result = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: promptText,
        })
        
        clearTimeout(timeoutId)
        
        const rawText = result.text || ''
        console.log('📝 Gemini raw response length:', rawText.length, 'chars')
        console.log('📝 Gemini raw response preview:', rawText.substring(0, 200))
        
        // Wrap JSON.parse in try/catch before Zod validation
        let parsedJson: unknown | null = null
        try {
          parsedJson = tryParseJson(rawText.trim())
        } catch (parseError) {
          logError('JSON parse failed', { error: parseError, requestId, rawTextPreview: rawText.substring(0, 500) })
        }

        const duration = Date.now() - startTime
        logApiCall('Gemini', 'gemini-2.0-flash-exp', 200, duration, requestId)

        if (parsedJson && typeof parsedJson === 'object') {
          const structuredData = parsedJson as Record<string, unknown>
          console.log('✅ Parsed JSON structure:', Object.keys(structuredData))
          
          // Add source field to Gemini response
          const responseWithSource = {
            ...structuredData,
            source: 'gemini' as const,
          }
          
          // Validate response with Zod
          const responseValidation = ScenarioResponseSchema.safeParse(responseWithSource)
          if (responseValidation.success) {
            console.log('✅ Gemini prompts validated successfully:', responseValidation.data.prompts.length, 'prompts')
            return responseValidation.data
          } else {
            console.error('❌ Response validation failed:', responseValidation.error.issues)
            logError('Response validation failed', { errors: responseValidation.error.issues, requestId, structuredData })
            // Fall through to fallback
          }
        } else {
          console.error('❌ Failed to parse JSON from Gemini response')
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

      // Fallback: keyword detection → category → predefined prompts
      const category = detectCategoryFromScenario(scenario) || 'surprise' // Default to surprise if no match
      const fallbackPrompts = getFallbackPrompts(category as PromptCategory)
      console.log('🔄 Using fallback prompts for category:', category, 'prompts:', fallbackPrompts.length)

      return {
        prompts: fallbackPrompts,
        source: 'fallback' as const,
      }
    })()

    // Store promise for idempotency
    if (idempotencyKey) {
      inFlightRequests.set(idempotencyKey, requestPromise)
      // Clean up after 30 seconds
      setTimeout(() => {
        inFlightRequests.delete(idempotencyKey)
      }, 30000)
    }

    const result = await requestPromise
    const duration = Date.now() - startTime

    // Validate final response
    const finalValidation = ScenarioResponseSchema.safeParse(result)
    if (!finalValidation.success) {
      logError('Final response validation failed', { errors: finalValidation.error.issues, requestId })
      return serverError('Invalid response format', 'RESPONSE_VALIDATION_ERROR', requestId)
    }

    return ok(finalValidation.data, requestId)
    
  } catch (error) {
    const duration = Date.now() - startTime
    logError('Scenario prompts endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      duration, 
      requestId 
    })
    return serverError('Prompt generation failed', 'INTERNAL_ERROR', requestId)
  }
}

