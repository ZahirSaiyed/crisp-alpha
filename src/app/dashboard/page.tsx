"use client";

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ProgressChart from '@/components/ProgressChart'
import MetricDelta from '@/components/MetricDelta'
import LoadingOverlay from '@/components/LoadingOverlay'
import posthog from 'posthog-js'

interface Session {
  session_id: string
  timestamp: string
  confidence_score: number
  clarity_score: number
  pace_wpm: number
  filler_word_rate: number
  total_words: number
  talk_time_sec: number
  pause_count: number
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return

    async function migrateSessions() {
      // Check if user has anonymous sessions to migrate
      const anonId = localStorage.getItem('crisp_anon_id')
      if (anonId) {
        try {
          const response = await fetch('/api/sessions/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anon_id: anonId }),
          })
          
          if (response.ok) {
            const result = await response.json()
            const migrated = result.data?.migrated || 0
            if (migrated > 0) {
              localStorage.removeItem('crisp_anon_id')
            }
          }
        } catch (err) {
          console.error('Migration error:', err)
        }
      }
    }

    async function fetchSessions() {
      try {
        // First, migrate any anonymous sessions
        await migrateSessions()
        
        // Then fetch all sessions
        const response = await fetch('/api/sessions/recent')
        if (!response.ok) {
          throw new Error('Failed to fetch sessions')
        }
        const result = await response.json()
        // API returns: { data: { sessions: [...] } }
        const sessions = result.data?.sessions || []
        setSessions(sessions)
        
        posthog.capture('viewed_dashboard', {
          session_count: sessions.length || 0
        })
      } catch (err) {
        console.error('Error fetching sessions:', err)
        setError('Failed to load your sessions')
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [user])

  if (authLoading || loading) {
    return <LoadingOverlay show={true} label="Loading your progress..." />
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#F9F9FB] to-white text-[color:var(--ink)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/record')}
            className="px-6 py-2 rounded-full bg-[color:var(--bright-purple)] text-white hover:opacity-90"
          >
            Go to Record
          </button>
        </div>
      </main>
    )
  }

  // Calculate deltas if we have at least 2 sessions
  const hasMultipleSessions = sessions.length >= 2
  const latestSession = sessions[0]
  const firstSession = sessions[sessions.length - 1]

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F9F9FB] to-white text-[color:var(--ink)]">
      <header className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-bold text-[color:var(--ink)]">Your Progress</h1>
        <p className="text-[color:rgba(11,11,12,0.65)] mt-2">
          Track your speaking confidence over time
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-12 grid gap-6">
        {sessions.length === 0 ? (
          <div className="rounded-[20px] shadow-[0_4px_20px_rgba(11,11,12,0.08)] bg-white border border-[color:var(--muted-2)] p-12 text-center">
            <div className="text-5xl mb-4">🎤</div>
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-2">
              No sessions yet
            </h2>
            <p className="text-[color:rgba(11,11,12,0.6)] mb-6">
              Record your first session to start tracking your progress
            </p>
            <button
              onClick={() => router.push('/record')}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[color:var(--bright-purple)] to-[color:#9D7FFF] text-white font-semibold shadow-[0_4px_12px_rgba(122,92,255,0.25)] hover:shadow-[0_6px_20px_rgba(122,92,255,0.35)] transition-all duration-200 transform hover:scale-105"
            >
              Start Recording
            </button>
          </div>
        ) : (
          <>
            {/* Main progress chart */}
            <ProgressChart sessions={sessions} />

            {/* Metric deltas */}
            {hasMultipleSessions && latestSession && firstSession && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricDelta
                  label="Clarity"
                  current={latestSession.clarity_score}
                  previous={firstSession.clarity_score}
                  format="percentage"
                />
                <MetricDelta
                  label="Filler Words"
                  current={latestSession.filler_word_rate}
                  previous={firstSession.filler_word_rate}
                  format="percentage"
                  inverse={true}
                />
                <MetricDelta
                  label="Pace"
                  current={latestSession.pace_wpm}
                  previous={firstSession.pace_wpm}
                  format="wpm"
                />
              </div>
            )}

            {/* Encouraging message */}
            {hasMultipleSessions && latestSession && firstSession && (
              <div className="rounded-lg bg-gradient-to-r from-[color:var(--bright-purple)]/10 to-[color:#9D7FFF]/10 border border-[color:var(--bright-purple)]/20 p-6">
                <p className="text-[color:var(--ink)] font-medium">
                  {latestSession.confidence_score > firstSession.confidence_score
                    ? `🎉 You're ${Math.round((latestSession.confidence_score - firstSession.confidence_score) * 100)}% more confident than your first session!`
                    : "Keep practicing! Confidence builds with every session."}
                </p>
              </div>
            )}

            {/* Call to action */}
            <div className="text-center">
              <button
                onClick={() => router.push('/record')}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-[color:var(--bright-purple)] to-[color:#9D7FFF] text-white font-semibold shadow-[0_4px_12px_rgba(122,92,255,0.25)] hover:shadow-[0_6px_20px_rgba(122,92,255,0.35)] transition-all duration-200 transform hover:scale-105"
              >
                Record Another Session
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

