import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  // Use request origin as it's always correct (the actual domain the request came from)
  // Only use NEXT_PUBLIC_BASE_URL if it's explicitly set and doesn't contain localhost (production safety)
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  const baseUrl = (envBaseUrl && !envBaseUrl.includes('localhost')) 
    ? envBaseUrl 
    : requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    
    // Create a response object to set cookies on
    const response = NextResponse.redirect(`${baseUrl}/dashboard`)
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ Auth callback error:', error)
      return NextResponse.redirect(`${baseUrl}/?error=auth_failed`)
    }

    return response
  }

  // No code provided, redirect to home
  return NextResponse.redirect(`${baseUrl}/`)
}

