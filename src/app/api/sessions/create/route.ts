import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { badRequest, serverError, ok } from '@/lib/http'
import { getRequestId } from '@/lib/context'

const CreateSessionSchema = z.object({
  clarity_score: z.number().min(0).max(1),
  filler_word_rate: z.number().min(0).max(1),
  confidence_score: z.number().min(0).max(1),
  pace_wpm: z.number().int().min(0),
  total_words: z.number().int().min(0),
  talk_time_sec: z.number().min(0),
  pause_count: z.number().int().min(0),
  user_id: z.string().uuid().optional(),
  anon_id: z.string().uuid().optional(),
  scenario: z.string().max(500).nullable().optional(),
  intent: z.enum(['decisive', 'natural', 'calm', 'persuasive', 'empathetic']).nullable().optional(),
})

export async function POST(request: Request) {
  const requestId = getRequestId()

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return ok({ session_id: null, message: 'Supabase not configured' }, requestId)
    }

    const body = await request.json()
    const validated = CreateSessionSchema.safeParse(body)

    if (!validated.success) {
      return badRequest('Invalid request body', 'INVALID_BODY', requestId)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(cookieStore)

    if (!supabase) {
      return serverError('Database not available', 'DB_UNAVAILABLE', requestId)
    }

    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser()

    // Prepare session data
    const sessionData = {
      user_id: user?.id || null,
      anon_id: validated.data.anon_id || null,
      clarity_score: validated.data.clarity_score,
      filler_word_rate: validated.data.filler_word_rate,
      confidence_score: validated.data.confidence_score,
      pace_wpm: validated.data.pace_wpm,
      total_words: validated.data.total_words,
      talk_time_sec: validated.data.talk_time_sec,
      pause_count: validated.data.pause_count,
      scenario: validated.data.scenario || null,
      intent: validated.data.intent || null,
    }

    // For anonymous sessions, use admin client to avoid RLS issues
    // For authenticated sessions, use regular client so RLS validates ownership
    const clientToUse = user ? supabase : createAdminClient()
    
    if (!clientToUse) {
      console.warn('⚠️ Database client not available - Supabase admin credentials may not be configured')
      // Return success but with null session_id - session won't be saved but app continues
      return ok({ 
        session_id: null, 
        message: 'Session not saved (Supabase not configured)' 
      }, requestId)
    }

    // Insert session
    try {
      const { data, error } = await clientToUse
        .from('sessions')
        .insert(sessionData)
        .select('session_id')
        .single()

      if (error) {
        // Check if it's a fetch/network error
        if (error.message && (error.message.includes('fetch failed') || error.message.includes('TypeError'))) {
          console.warn('⚠️ Supabase connection failed. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
          return ok({ 
            session_id: null, 
            message: 'Session not saved (database connection failed)' 
          }, requestId)
        }
        
        console.error('❌ Supabase insert error:', JSON.stringify(error, null, 2))
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        return serverError(`Failed to create session: ${error.message}`, 'DB_INSERT_ERROR', requestId)
      }

      return ok({ 
        session_id: data?.session_id,
        message: 'Session created successfully'
      }, requestId)
    } catch (dbError) {
      // Handle fetch failures (Supabase not configured or network issues)
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      if (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError')) {
        console.warn('⚠️ Supabase connection failed. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
        console.warn('⚠️ Error:', errorMessage)
        // Return success but with null session_id - app continues without saving
        return ok({ 
          session_id: null, 
          message: 'Session not saved (database connection failed)' 
        }, requestId)
      }
      // For other errors, log and return gracefully
      console.error('❌ Unexpected database error:', dbError)
      return ok({ 
        session_id: null, 
        message: 'Session not saved (error occurred)' 
      }, requestId)
    }
  } catch (error) {
    console.error('Session creation error:', error)
    // Even on unexpected errors, return ok with null so the app doesn't break
    return ok({ 
      session_id: null, 
      message: 'Session not saved (error occurred)' 
    }, requestId)
  }
}

