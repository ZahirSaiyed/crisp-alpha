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
    <div className="bg-white border border-[color:var(--muted-2)] rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.6)] mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-[color:var(--ink)]">
          {formatValue(current)}
        </div>
        {previous !== 0 && (
          <div
            className={`text-sm font-medium flex items-center gap-1 ${
              isImprovement
                ? 'text-green-600'
                : percentChange === 0
                ? 'text-[color:rgba(11,11,12,0.5)]'
                : 'text-red-600'
            }`}
          >
            {isImprovement && percentChange !== 0 && '↑'}
            {!isImprovement && percentChange !== 0 && '↓'}
            {percentChange === 0 && '→'}
            <span>{Math.abs(percentChange).toFixed(0)}%</span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-[color:rgba(11,11,12,0.5)] mt-1">
        vs. first session
      </div>
    </div>
  )
}

