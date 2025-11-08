"use client";

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = React.useState(false)

  if (!isOpen) return null

  const handleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
      onSuccess?.()
    } catch (error) {
      console.error('Sign in failed:', error)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[color:rgba(11,11,12,0.4)] hover:text-[color:var(--ink)] transition-colors"
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-2">
            Track your growth?
          </h2>
          <p className="text-[color:rgba(11,11,12,0.7)] mb-6">
            Create a free account to save this session and see your improvement over time.
          </p>

          {/* Google Sign In Button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full px-6 py-3 rounded-full bg-white border-2 border-[color:var(--muted-2)] text-[color:var(--ink)] font-medium hover:border-[color:var(--bright-purple)] hover:shadow-[0_4px_16px_rgba(122,92,255,0.15)] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                Sign in with Google
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="mt-4 text-sm text-[color:rgba(11,11,12,0.6)] hover:text-[color:var(--ink)] transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

