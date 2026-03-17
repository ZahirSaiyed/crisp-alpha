"use client";

import { DrillConfig } from "../lib/focus";

interface DrillCardProps {
  drill: DrillConfig;
}

export default function DrillCard({ drill }: DrillCardProps) {
  return (
    <section className="rounded-[var(--radius-lg)] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[var(--muted-2)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--intent-decisive)] font-medium">
          Next rep
        </div>
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-light)] font-medium bg-[var(--muted-1)] px-2 py-1 rounded-full border border-[var(--muted-2)]">
          {drill.durationSec}s drill
        </div>
      </div>

      <div
        className="text-lg sm:text-xl font-bold text-[var(--ink)] leading-snug tracking-[-0.01em] mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {drill.title}
      </div>

      <p className="text-[14px] text-[var(--ink-light)] leading-relaxed mb-4">
        {drill.instruction}
      </p>

      {drill.snippet && (
        <div className="rounded-xl bg-[var(--muted-1)] border border-[var(--muted-2)] p-3 sm:p-4">
          {drill.snippetHint && (
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-light)] font-medium mb-1">
              {drill.snippetHint}
            </div>
          )}
          <p className="text-sm sm:text-base text-[var(--ink)] font-medium leading-relaxed italic">
            &ldquo;{drill.snippet}&rdquo;
          </p>
        </div>
      )}
    </section>
  );
}
