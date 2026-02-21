"use client";

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignUpPage() {
  const { signInWithGoogle, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--ink-light)]">Loading...</p>
        </div>
      </main>
    )
  }

  // Don't render sign-up form if user is authenticated (will redirect)
  if (user) {
    return null
  }

  const handleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
      // Redirect is handled by OAuth callback
    } catch (error) {
      console.error('Sign in failed:', error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Optional ambient blob for parity with hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[var(--muted-1)]/40 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none" />
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] border border-[var(--muted-2)] p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <Link 
              href="/"
              className="inline-block display-headline text-[var(--bright-purple)] text-3xl font-extrabold drop-shadow-[0_4px_16px_rgba(122,92,255,0.25)] tracking-[-0.01em] mb-4"
            >
              Crisp
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--ink)] mb-2 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Save your sessions and track your growth
            </h1>
            <p className="text-sm sm:text-base text-[var(--ink-light)]">
              Sign up with Google to get started
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full px-6 py-3.5 rounded-full bg-white border-2 border-[var(--muted-2)] text-[var(--ink)] font-medium hover:border-[var(--intent-persuasive)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.15)] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                    fill="#EA4335"
                  />
                </svg>
                Sign up with Google
              </>
            )}
          </button>

          {/* Trust builders */}
          <div className="text-center mb-6">
            <p className="text-xs sm:text-sm text-[var(--ink-light)] font-medium tracking-wide">
              Free forever • No credit card required • Private & secure
            </p>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--muted-2)]"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-4 text-[var(--ink-light)]">or</span>
            </div>
          </div>

          {/* Footer links */}
          <div className="text-center space-y-2">
            <p className="text-sm text-[var(--ink-light)]">
              Already have an account?<br />
              <span className="text-[var(--bright-purple)] font-medium">
                Just sign in with Google above
              </span>
            </p>
            <Link
              href="/privacy"
              className="block text-xs text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors mt-4"
            >
              Privacy Policy
            </Link>
          </div>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </motion.div>
    </main>
  )
}

