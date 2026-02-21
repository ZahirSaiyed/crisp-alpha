"use client";

import React from 'react'

interface MetricDeltaProps {
  label: string
  current: number
  previous: number
  format?: 'percentage' | 'number' | 'wpm'
  inverse?: boolean // If true, lower is better (e.g., filler words)
}

export default function MetricDelta({ 
  label, 
  current, 
  previous, 
  format = 'percentage',
  inverse = false 
}: MetricDeltaProps) {
  const delta = current - previous
  const percentChange = previous !== 0 ? (delta / previous) * 100 : 0
  const isImprovement = inverse ? delta < 0 : delta > 0
  
  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${Math.round(val * 100)}%`
      case 'wpm':
        return `${Math.round(val)} WPM`
      case 'number':
      default:
        return Math.round(val).toString()
    }
  }

  return (
    <div className="bg-white border border-[var(--muted-2)] rounded-[var(--radius-lg)] p-4">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-light)] mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-[var(--ink)]">
          {formatValue(current)}
        </div>
        {previous !== 0 && (
          <div
            className={`text-sm font-medium flex items-center gap-1 ${
              isImprovement
                ? 'text-[var(--ok)]'
                : percentChange === 0
                ? 'text-[var(--ink-light)]'
                : 'text-[var(--bad)]'
            }`}
          >
            {isImprovement && percentChange !== 0 && '↑'}
            {!isImprovement && percentChange !== 0 && '↓'}
            {percentChange === 0 && '→'}
            <span>{Math.abs(percentChange).toFixed(0)}%</span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-[var(--ink-light)] mt-1">
        vs. first session
      </div>
    </div>
  )
}

