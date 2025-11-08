import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { badRequest, serverError, ok } from '@/lib/http'
import { getRequestId } from '@/lib/context'

const SessionMetricsSchema = z.object({
  anon_id: z.string().uuid().optional(),
  clarity_score: z.number().min(0).max(1),
  pace_wpm: z.number().int().min(0),
  filler_word_rate: z.number().min(0).max(1),
  confidence_score: z.number().min(0).max(1),
  total_words: z.number().int().min(0),
  talk_time_sec: z.number().min(0),
  pause_count: z.number().int().min(0),
  scenario: z.string().max(500).nullable().optional(),
  intent: z.enum(['decisive', 'natural', 'calm', 'persuasive', 'empathetic']).nullable().optional(),
})

export async function POST(request: Request) {
  const requestId = getRequestId()

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return ok({ 
        session_id: null, 
        message: 'Session saved locally (Supabase not configured)' 
      }, requestId)
    }

    const body = await request.json()
    const validated = SessionMetricsSchema.safeParse(body)

    if (!validated.success) {
      return badRequest('Invalid session metrics', 'INVALID_METRICS', requestId)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(cookieStore)

    if (!supabase) {
      return serverError('Database not available', 'DB_UNAVAILABLE', requestId)
    }

    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser()

    // Prepare insert data
    const insertData = {
      user_id: user?.id || null,
      anon_id: !user ? validated.data.anon_id || null : null,
      clarity_score: validated.data.clarity_score,
      pace_wpm: validated.data.pace_wpm,
      filler_word_rate: validated.data.filler_word_rate,
      confidence_score: validated.data.confidence_score,
      total_words: validated.data.total_words,
      talk_time_sec: validated.data.talk_time_sec,
      pause_count: validated.data.pause_count,
      scenario: validated.data.scenario || null,
      intent: validated.data.intent || null,
    }
    
    // For anonymous sessions, use admin client to avoid RLS issues with stale auth
    // For authenticated sessions, use regular client so RLS validates ownership
    const clientToUse = user ? supabase : createAdminClient()
    
    if (!clientToUse) {
      return serverError('Database client not available', 'DB_CLIENT_UNAVAILABLE', requestId)
    }
    
    const { data, error } = await clientToUse
      .from('sessions')
      .insert(insertData)
      .select('session_id')
      .single()

    if (error) {
      console.error('❌ Supabase insert error:', JSON.stringify(error, null, 2))
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return serverError(`Database error: ${error.message}`, 'DB_INSERT_ERROR', requestId)
    }

    return ok({ session_id: data?.session_id }, requestId)
  } catch (error) {
    console.error('Session creation error:', error)
    return serverError('Failed to create session', 'UNKNOWN_ERROR', requestId)
  }
}

