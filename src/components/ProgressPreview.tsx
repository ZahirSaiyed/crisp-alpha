"use client";

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from './AuthModal'

interface ProgressPreviewProps {
  onSignIn?: () => void
}

export default function ProgressPreview({ onSignIn }: ProgressPreviewProps) {
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = React.useState(false)

  // Don't show if user is already authenticated
  if (user) return null

  return (
    <>
      <div className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-6 relative overflow-hidden">
        {/* Blurred preview graph */}
        <div className="relative">
          <div className="absolute inset-0 backdrop-blur-[8px] bg-white/80 z-10 rounded-lg flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-5xl mb-3">🔒</div>
              <h3 className="text-xl font-bold text-[color:var(--ink)] mb-2">
                Track your progress
              </h3>
              <p className="text-sm text-[color:rgba(11,11,12,0.7)] mb-4">
                Sign in to save your sessions and watch your confidence grow over time.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[color:var(--bright-purple)] to-[color:#9D7FFF] text-white font-semibold shadow-[0_4px_12px_rgba(122,92,255,0.25)] hover:shadow-[0_6px_20px_rgba(122,92,255,0.35)] transition-all duration-200 transform hover:scale-105"
              >
                Get started
              </button>
            </div>
          </div>

          {/* Mock graph preview (blurred in background) */}
          <div className="h-48 flex items-end gap-2 px-4 pb-4">
            {[0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.72].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-[color:var(--bright-purple)]/30 to-[color:var(--bright-purple)]/10 rounded-t-md transition-all duration-300"
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Subtext */}
        <div className="mt-4 text-xs text-[color:rgba(11,11,12,0.55)] text-center">
          Free forever • No credit card required
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false)
          onSignIn?.()
        }}
      />
    </>
  )
}

