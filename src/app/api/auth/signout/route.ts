import { createServerClient as createServerClientBase } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  
  // Create response first so we can set cookies on it
  const response = NextResponse.json({ success: true })
  
  // Create Supabase client with proper cookie handling
  const supabase = createServerClientBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Delete the cookie by setting it with max-age=0
            if (value === '' || options?.maxAge === 0) {
              response.cookies.delete(name)
            } else {
              response.cookies.set(name, value, options)
            }
          })
        },
      },
    }
  )

  if (supabase) {
    await supabase.auth.signOut()
  }

  return response
}

