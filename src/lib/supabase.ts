import { createBrowserClient as createBrowserClientBase } from '@supabase/ssr'
import { createServerClient as createServerClientBase } from '@supabase/ssr'

// Get Supabase credentials from environment
function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn('Supabase credentials not configured. Progress tracking features will be disabled.')
    return null
  }

  return { url, anonKey }
}

/**
 * Browser client for client-side operations (auth, queries from React components)
 */
export function createBrowserClient() {
  const credentials = getSupabaseCredentials()
  
  if (!credentials) {
    // Return a mock client that fails gracefully
    return null
  }

  return createBrowserClientBase(
    credentials.url,
    credentials.anonKey
  )
}

/**
 * Server client for API routes and server components
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServerClient(cookieStore: any) {
  const credentials = getSupabaseCredentials()
  
  if (!credentials) {
    return null
  }

  return createServerClientBase(
    credentials.url,
    credentials.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Admin client with service role key (server-side only, use sparingly)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.warn('Supabase admin credentials not configured.')
    return null
  }

  // Dynamic import to avoid bundling in client-side code
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js')
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!getSupabaseCredentials()
}

