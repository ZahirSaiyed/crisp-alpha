import { cookies } from 'next/headers'
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase'
import { unauthorized, serverError, ok } from '@/lib/http'
import { getRequestId } from '@/lib/context'

export async function GET() {
  const requestId = getRequestId()

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return ok({ sessions: [] }, requestId)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(cookieStore)

    if (!supabase) {
      return serverError('Database not available', 'DB_UNAVAILABLE', requestId)
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorized('Authentication required', 'AUTH_REQUIRED', requestId)
    }

    // Fetch last 10 sessions for this user
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching sessions:', error)
      return serverError('Failed to fetch sessions', 'DB_QUERY_ERROR', requestId)
    }

    return ok({ sessions: data || [] }, requestId)
  } catch (error) {
    console.error('Recent sessions error:', error)
    return serverError('Failed to fetch sessions', 'UNKNOWN_ERROR', requestId)
  }
}

