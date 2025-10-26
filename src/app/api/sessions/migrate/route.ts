import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { badRequest, unauthorized, serverError, ok } from '@/lib/http'
import { getRequestId } from '@/lib/context'

const MigrateSchema = z.object({
  anon_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const requestId = getRequestId()

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return ok({ migrated: 0, message: 'Supabase not configured' }, requestId)
    }

    const body = await request.json()
    const validated = MigrateSchema.safeParse(body)

    if (!validated.success) {
      return badRequest('Invalid request body', 'INVALID_BODY', requestId)
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

    // Use admin client to bypass RLS for migrating anonymous sessions
    const adminClient = createAdminClient()
    
    if (!adminClient) {
      return serverError('Database admin client not available', 'DB_ADMIN_UNAVAILABLE', requestId)
    }

    // Migrate all anonymous sessions to the authenticated user
    const { data, error } = await adminClient
      .from('sessions')
      .update({ 
        user_id: user.id, 
        anon_id: null 
      })
      .eq('anon_id', validated.data.anon_id)
      .is('user_id', null)
      .select('session_id')

    if (error) {
      console.error('❌ Migration error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return serverError(`Migration failed: ${error.message}`, 'DB_UPDATE_ERROR', requestId)
    }

    return ok({ 
      migrated: data?.length || 0,
      message: `Migrated ${data?.length || 0} session(s)`
    }, requestId)
  } catch (error) {
    console.error('Session migration error:', error)
    return serverError('Failed to migrate sessions', 'UNKNOWN_ERROR', requestId)
  }
}

