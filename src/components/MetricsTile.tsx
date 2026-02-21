"use client";

import React, { useMemo } from "react";

export default function MetricsTile({
  talkTimeSec,
  wpm,
  pauseCount,
  fillerCount,
  mostCommonFiller,
  approximate,
}: {
  talkTimeSec?: number | null;
  wpm?: number | null;
  pauseCount?: number | null;
  fillerCount?: number | null;
  mostCommonFiller?: string | null;
  approximate?: boolean;
}) {
  const chips = useMemo(() => {
    const tilde = approximate ? "~" : "";
    const fmtTime = (sec: number | null) => {
      if (!sec || !Number.isFinite(sec) || sec <= 0) return "—";
      const s = Math.round(sec);
      const mPart = Math.floor(s / 60);
      const sPart = s % 60;
      return `${mPart}:${sPart.toString().padStart(2, "0")}`;
    };
    return [
      {
        key: "talktime",
        label: "TALK TIME",
        value: `${tilde}${fmtTime(talkTimeSec ?? null)}`,
        suffix: "Total duration",
        tooltip: "Estimated talk duration excluding long silences.",
      },
      {
        key: "pace",
        label: "WPM",
        value: wpm != null && Number.isFinite(wpm) ? `${tilde}${Math.round(wpm)}` : "—",
        suffix: "Words per minute",
        tooltip: "Words per minute. Approximate during capture; final when transcript completes.",
      },
      {
        key: "pauses",
        label: "# PAUSES",
        value: pauseCount != null ? `${tilde}${pauseCount}` : "—",
        suffix: ">=0.5s gaps",
        tooltip: "Detected pauses ≥0.5s using energy/timing. Finalized with word timestamps.",
      },
      {
        key: "fillers",
        label: "# FILLER WORDS",
        value: fillerCount != null ? `${tilde}${fillerCount}` : "—",
        suffix: "um, uh, like...",
        tooltip: "Counts common fillers (um, uh, like, you know).",
      },
      {
        key: "topfiller",
        label: "TOP FILLER",
        value: mostCommonFiller ? `"${mostCommonFiller}"` : "—",
        suffix: "Most frequent",
        tooltip: "Most common filler word used.",
      },
    ];
  }, [wpm, pauseCount, fillerCount, talkTimeSec, mostCommonFiller, approximate]);

  return (
    <div className="rounded-[var(--radius-lg)] shadow-[0_4px_20px_rgba(11,11,12,0.08),_0_2px_8px_rgba(11,11,12,0.04)] bg-white/95 backdrop-blur border border-[var(--muted-2)] p-5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--bright-purple)] mb-4 font-medium">Your Speaking Metrics</div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {chips.slice(0, 5).map((c) => (
          <div
            key={c.key}
            className="bg-white border border-[var(--muted-2)] rounded-[var(--radius-lg)] p-3 text-left"
            title={c.tooltip}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-light)] mb-1">{c.label}</div>
            <div className="text-xl font-bold text-[var(--ink)] mb-1">{c.value}</div>
            <div className="text-[11px] text-[var(--ink-light)]">{c.suffix || c.tooltip?.split('.')[0]}</div>
          </div>
        ))}
        {chips.length === 0 && (
          <div className="col-span-2 sm:col-span-5 bg-white border border-[var(--muted-2)] rounded-[var(--radius-lg)] p-3 text-center">
            <div className="text-[11px] text-[var(--ink-light)]">Initializing metrics...</div>
          </div>
        )}
      </div>
      {approximate && (
        <div className="mt-2 text-[11px] text-[var(--ink-light)]">~ approximate. Refines as transcript completes.</div>
      )}
    </div>
  );
} 