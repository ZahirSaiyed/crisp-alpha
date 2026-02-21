"use client";

import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface SessionData {
  session_id: string
  timestamp: string
  confidence_score: number
  clarity_score: number
  pace_wpm: number
  filler_word_rate: number
}

interface ProgressChartProps {
  sessions: SessionData[]
}

export default function ProgressChart({ sessions }: ProgressChartProps) {
  // Sort sessions by timestamp (oldest first for the chart)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Format data for chart
  const chartData = sortedSessions.map((session, index) => ({
    session: index + 1,
    confidence: session.confidence_score,
    timestamp: new Date(session.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  if (chartData.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] shadow-[0_4px_20px_rgba(11,11,12,0.08)] bg-white border border-[var(--muted-2)] p-6">
        <div className="text-center text-[var(--ink-light)]">
          No sessions yet. Start recording to see your progress!
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white border border-[var(--muted-2)] rounded-[var(--radius-lg)] shadow-lg p-3">
          <p className="text-xs text-[var(--ink-light)] mb-1">
            Session {data.session} • {data.timestamp}
          </p>
          <p className="text-sm font-semibold text-[var(--bright-purple)]">
            {Math.round(data.confidence * 100)}% confidence
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-[var(--radius-lg)] shadow-[0_4px_20px_rgba(11,11,12,0.08)] bg-white border border-[var(--muted-2)] p-6">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--bright-purple)] mb-4 font-medium">
        Confidence Over Time
      </div>
      
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,11,12,0.08)" />
          <XAxis
            dataKey="session"
            stroke="rgba(11,11,12,0.4)"
            tick={{ fontSize: 12, fill: 'rgba(11,11,12,0.6)' }}
            label={{ value: 'Session', position: 'insideBottom', offset: -5, fontSize: 12, fill: 'rgba(11,11,12,0.6)' }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(value) => `${Math.round(value * 100)}%`}
            stroke="rgba(11,11,12,0.4)"
            tick={{ fontSize: 12, fill: 'rgba(11,11,12,0.6)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke="var(--bright-purple)"
            strokeWidth={3}
            dot={{ 
              r: 5, 
              fill: 'var(--bright-purple)', 
              strokeWidth: 2, 
              stroke: 'white' 
            }}
            activeDot={{ r: 7 }}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-[var(--ink-light)] text-center">
        {chartData.length} session{chartData.length !== 1 ? 's' : ''} recorded
      </div>
    </div>
  )
}

