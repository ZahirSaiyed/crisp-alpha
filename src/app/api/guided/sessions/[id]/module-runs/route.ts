import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { badRequest, serverError, ok } from '@/lib/http'
import { getRequestId } from '@/lib/context'
import { detectFillerCounts, detectCARStructure } from '@/lib/analysis'
import { GoogleGenAI } from '@google/genai'
import { ENV, GEMINI_MODEL } from '@/lib/env'
import { logApiCall, logError } from '@/lib/log'
import { ModuleScoresSchema, ModuleFeedbackSchema, type ModuleScores, type ModuleFeedback } from '@/lib/guided/types'
import { NUDGE_TYPES } from '@/lib/guided/constants'

const CompleteModuleRunSchema = z.object({
  module_index: z.number().int().min(0),
  inputs: z.record(z.unknown()).optional(),
  transcript: z.string().optional(),
  recording_ref: z.string().uuid().optional(),
  attempt: z.number().int().min(0).default(0),
  parent_run_id: z.string().uuid().optional(),
})

function detectNudge(transcript: string, words: Array<{ word: string }>): { type: string; text: string } | null {
  if (!transcript || transcript.trim().length === 0) return null;

  const fillers = detectFillerCounts(words);
  const fillerRate = words.length > 0 ? fillers.total / words.length : 0;
  const wordCount = words.length;
  const carScore = detectCARStructure(transcript);
  const avgSentenceLength = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0).reduce((sum, s) => sum + s.split(/\s+/).length, 0) / Math.max(1, transcript.split(/[.!?]+/).filter(s => s.trim().length > 0).length);

  // Rule-based nudge detection
  if (fillerRate > 0.05 && wordCount > 20) {
    // Too many fillers
    return { type: 'example', text: NUDGE_TYPES.EXAMPLE };
  }

  if (carScore < 0.4 && wordCount > 30) {
    // Long answer without structure
    return { type: 'car', text: NUDGE_TYPES.CAR };
  }

  if (avgSentenceLength > 25 && wordCount > 40) {
    // Too verbose
    return { type: 'one_sentence', text: NUDGE_TYPES.ONE_SENTENCE };
  }

  // Check for lack of specificity (no numbers, metrics, concrete examples)
  const hasNumbers = /\d/.test(transcript);
  const hasConcreteExamples = /\b(example|instance|case|time|when|project|feature|system|product)\b/i.test(transcript);
  
  if (!hasNumbers && !hasConcreteExamples && wordCount > 25) {
    return { type: 'example', text: NUDGE_TYPES.EXAMPLE };
  }

  return null;
}

async function generateFeedback(
  transcript: string,
  rubricFocus?: 'clarity' | 'structure' | 'specificity'
): Promise<ModuleFeedback> {
  const focus = rubricFocus || 'structure';
  
  const prompt = `You are a constructive communication coach providing focused feedback.

Analyze this interview answer and provide:
1. ONE score (0-10 scale) for ${focus}
2. ONE actionable fix (single sentence)
3. ONE rerun challenge (optional prompt for improvement)

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations.

Required JSON schema:
{
  "score_label": "${focus.charAt(0).toUpperCase() + focus.slice(1)}: X/10",
  "fix": "One actionable sentence",
  "rerun_challenge": "Optional prompt for next attempt"
}

Guidelines:
- Score should reflect ${focus} specifically
- Fix should be concrete and actionable
- Rerun challenge should guide improvement
- Keep all text concise

Answer to analyze:
"""
${transcript.substring(0, 2000)}
"""`;

  try {
    const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const rawText = result.text || '';
    
    // Try to parse JSON
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      // Try extracting JSON from markdown
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (parsed && typeof parsed === 'object') {
      const validation = ModuleFeedbackSchema.safeParse(parsed);
      if (validation.success) {
        return validation.data;
      }
    }
  } catch (error) {
    logError('Feedback generation failed', { error: error instanceof Error ? error.message : 'Unknown' });
  }

  // Fallback feedback
  return {
    score_label: `${focus.charAt(0).toUpperCase() + focus.slice(1)}: 6/10`,
    fix: 'Focus on providing concrete examples and clear structure.',
    rerun_challenge: 'Try again with a specific example from your experience.',
  };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId();
  const sessionId = params.id;

  try {
    if (!isSupabaseConfigured()) {
      return ok({ run_id: null, message: 'Supabase not configured' }, requestId);
    }

    const body = await request.json();
    const validated = CompleteModuleRunSchema.safeParse(body);

    if (!validated.success) {
      const issues = validated.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return badRequest(`Invalid request body: ${issues}`, 'INVALID_BODY', requestId);
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);

    if (!supabase) {
      return serverError('Database not available', 'DB_UNAVAILABLE', requestId);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const clientToUse = user ? supabase : createAdminClient();

    if (!clientToUse) {
      return ok({ run_id: null, message: 'Database client not available' }, requestId);
    }

    // Get the guided session to check access and get prep_path
    const { data: session, error: sessionError } = await clientToUse
      .from('guided_sessions')
      .select('prep_path, status')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return badRequest('Session not found', 'SESSION_NOT_FOUND', requestId);
    }

    const prepPath = session.prep_path as { modules: Array<{ type: string; constraints?: { rubric_focus?: string } }> };
    const module = prepPath.modules[validated.data.module_index];

    if (!module) {
      return badRequest('Invalid module index', 'INVALID_MODULE_INDEX', requestId);
    }

    // Calculate scores and feedback for Coach Rep modules
    let scores: ModuleScores | undefined;
    let feedback: ModuleFeedback | undefined;

    if (module.type === 'coach_rep' && validated.data.transcript) {
      const words = validated.data.transcript.split(/\s+/).map((word, idx) => ({ word, start: idx * 0.5, end: (idx + 1) * 0.5 }));
      const fillers = detectFillerCounts(words);
      const fillerRate = words.length > 0 ? fillers.total / words.length : 0;
      const carScore = detectCARStructure(validated.data.transcript);
      const wpm = words.length > 0 ? (words.length / 60) * 60 : 0; // Rough estimate

      scores = {
        filler_rate: fillerRate,
        structure_score: carScore,
        clarity_score: 1 - fillerRate, // Simple clarity based on filler rate
        pace_wpm: Math.round(wpm),
        total_words: words.length,
      };

      // Generate feedback
      const rubricFocus = module.constraints?.rubric_focus as 'clarity' | 'structure' | 'specificity' | undefined;
      feedback = await generateFeedback(validated.data.transcript, rubricFocus);

      // Detect nudge
      const nudge = detectNudge(validated.data.transcript, words);
      if (nudge) {
        feedback.nudge = nudge;
      }
    }

    // Create or update module run
    const runData = {
      guided_session_id: sessionId,
      module_type: module.type as 'signal_map' | 'coach_rep',
      module_index: validated.data.module_index,
      status: 'completed' as const,
      attempt: validated.data.attempt,
      parent_run_id: validated.data.parent_run_id || null,
      inputs: validated.data.inputs || {},
      recording_ref: validated.data.recording_ref || null,
      transcript: validated.data.transcript || null,
      scores: scores || {},
      feedback: feedback || {},
      completed_at: new Date().toISOString(),
    };

    const { data: run, error: runError } = await clientToUse
      .from('module_runs')
      .insert(runData)
      .select('run_id')
      .single();

    if (runError) {
      console.error('❌ Failed to create module run:', runError);
      return serverError(`Failed to create module run: ${runError.message}`, 'DB_INSERT_ERROR', requestId);
    }

    // Update session status if needed
    if (session.status === 'planning') {
      await clientToUse
        .from('guided_sessions')
        .update({ status: 'in_progress' })
        .eq('session_id', sessionId);
    }

    return ok({
      run_id: run?.run_id,
      feedback,
      scores,
    }, requestId);
  } catch (error) {
    console.error('Module run completion error:', error);
    return serverError('Failed to complete module run', 'INTERNAL_ERROR', requestId);
  }
}
