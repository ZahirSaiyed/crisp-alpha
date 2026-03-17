"use client";

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ProgressChart from '@/components/ProgressChart'
import MetricDelta from '@/components/MetricDelta'
import LoadingOverlay from '@/components/LoadingOverlay'
import posthog from 'posthog-js'
import type { PrepPath } from '@/lib/guided/types'

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
  const [jdText, setJdText] = useState('')
  const [guidedPlan, setGuidedPlan] = useState<PrepPath | null>(null)
  const [guidedLoading, setGuidedLoading] = useState(false)
  const [guidedError, setGuidedError] = useState<string | null>(null)

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

  async function handleGuidedSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jdText.trim() || guidedLoading) return
    setGuidedLoading(true)
    setGuidedError(null)
    setGuidedPlan(null)
    try {
      const res = await fetch('/api/guided/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jdText }),
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.message || result.error || `Request failed: ${res.status}`)
      }
      const plan = result.data || result
      setGuidedPlan(plan as PrepPath)
    } catch (err) {
      setGuidedError(err instanceof Error ? err.message : 'Failed to generate prep path')
    } finally {
      setGuidedLoading(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingOverlay show={true} label="Loading your progress..." />
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--bg-warm)] text-[var(--ink)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--bad)] mb-4">{error}</p>
          <button
            onClick={() => router.push('/record')}
            className="px-6 py-2 rounded-full bg-[var(--intent-persuasive)] text-white font-medium hover:opacity-90 transition-opacity"
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
    <main className="min-h-screen bg-[var(--bg-warm)] text-[var(--ink)]">
      <header className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-bold text-[var(--ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Your Progress</h1>
        <p className="text-[var(--ink-light)] mt-2">
          Track your speaking confidence over time
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-12 grid gap-6">
        {sessions.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] shadow-[0_4px_20px_rgba(11,11,12,0.08)] bg-white border border-[var(--muted-2)] p-12 text-center">
            <div className="text-5xl mb-4">🎤</div>
            <h2 className="text-xl font-bold text-[var(--ink)] mb-2 tracking-tight">
              No sessions yet
            </h2>
            <p className="text-[var(--ink-light)] mb-6">
              Record your first session to start tracking your progress
            </p>
            <button
              onClick={() => router.push('/record')}
              className="cta-bottom-purple px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5"
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
              <div className="rounded-[var(--radius-lg)] bg-gradient-to-r from-[var(--intent-persuasive)]/10 to-[var(--bright-purple)]/10 border border-[var(--intent-persuasive)]/20 p-6">
                <p className="text-[var(--ink)] font-medium">
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
                className="cta-bottom-purple px-8 py-4 font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
              >
                Record Another Session
              </button>
            </div>
          </>
        )}

        {/* Guided Interview Prep card */}
        <div className="rounded-[var(--radius-lg)] shadow-[0_4px_20px_rgba(11,11,12,0.08)] bg-white border border-[var(--muted-2)] p-6">
          <h2 className="text-xl font-bold text-[var(--ink)] mb-1" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
            Prepare for an Interview
          </h2>
          <p className="text-sm text-[var(--ink-light)] mb-4">Paste a job description to generate a targeted practice path with signals and modules.</p>
          <form onSubmit={handleGuidedSubmit} className="space-y-3">
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description here — role, responsibilities, requirements..."
              rows={5}
              className="w-full px-4 py-3 text-sm text-[var(--ink)] bg-[var(--bg-warm)] border border-[var(--muted-2)] rounded-lg resize-none outline-none focus:border-[var(--bright-purple)] transition-colors placeholder:text-[var(--ink-light)]"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!jdText.trim() || guidedLoading}
                className="px-5 py-2 rounded-full bg-[var(--bright-purple)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {guidedLoading ? 'Generating…' : 'Generate Prep Path'}
              </button>
              {guidedLoading && (
                <div className="h-0.5 flex-1 rounded-full bg-[var(--muted-2)] overflow-hidden">
                  <div className="h-full bg-[var(--bright-purple)] animate-[loading-bar_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          </form>

          {guidedError && (
            <p className="mt-3 text-sm text-[var(--bad)]">{guidedError}</p>
          )}

          {guidedPlan && (
            <div className="mt-6 space-y-5">
              <div>
                <h3 className="text-base font-bold text-[var(--ink)] tracking-tight">{guidedPlan.title}</h3>
                <p className="text-sm text-[var(--ink-light)] mt-1">{guidedPlan.objective}</p>
              </div>

              {guidedPlan.signals && guidedPlan.signals.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--ink-light)] mb-2">Key Signals</p>
                  <div className="flex flex-wrap gap-2">
                    {guidedPlan.signals.map((signal) => (
                      <div key={signal.id} className="group relative">
                        <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-[var(--bright-purple)]/10 text-[var(--bright-purple)] cursor-default">
                          {signal.label}
                        </span>
                        {signal.evidence && signal.evidence.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-3 rounded-lg bg-[var(--ink)] text-white text-[12px] leading-5 shadow-lg">
                            {signal.evidence.map((e, i) => (
                              <p key={i} className="italic opacity-80">&ldquo;{e}&rdquo;</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guidedPlan.modules && guidedPlan.modules.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--ink-light)] mb-2">Practice Modules</p>
                  <ol className="space-y-3">
                    {guidedPlan.modules.map((mod, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--bright-purple)]/15 text-[var(--bright-purple)] text-[12px] font-bold flex items-center justify-center">{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-[var(--ink)]">{mod.goal}</p>
                          {mod.type === 'coach_rep' && (
                            <p className="text-[12px] text-[var(--ink-light)] mt-0.5">{mod.prompt}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

