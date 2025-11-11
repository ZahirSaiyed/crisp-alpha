"use client";

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createBrowserClient())

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signInWithGoogle = async () => {
    if (!supabase) {
      console.warn('Supabase not configured')
      return
    }

    // Always prefer window.location.origin (actual current domain) unless NEXT_PUBLIC_BASE_URL
    // is explicitly set and doesn't contain localhost (production safety check)
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const baseUrl = (envBaseUrl && !envBaseUrl.includes('localhost')) 
      ? envBaseUrl 
      : window.location.origin
    const redirectUrl = `${baseUrl}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    // Clear local state immediately
    setUser(null)
    localStorage.removeItem('crisp_anon_id')
    
    // Sign out from Supabase
    if (supabase) {
      await supabase.auth.signOut()
    }
    
    // Call server-side sign out to clear cookies
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore errors, we've already cleared local state
    }
    
    // Redirect to home
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

