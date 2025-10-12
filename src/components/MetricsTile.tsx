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
        key: "pace",
        label: "Pace",
        value: wpm != null && Number.isFinite(wpm) ? `${tilde}${Math.round(wpm)}` : "—",
        suffix: "WPM",
        tooltip: "Words per minute. Approximate during capture; final when transcript completes.",
      },
      {
        key: "pauses",
        label: "Pauses",
        value: pauseCount != null ? `${tilde}${pauseCount}` : "—",
        suffix: "count",
        tooltip: "Detected pauses ≥0.5s using energy/timing. Finalized with word timestamps.",
      },
      {
        key: "fillers",
        label: "Fillers",
        value: fillerCount != null ? `${tilde}${fillerCount}` : "—",
        suffix: mostCommonFiller ? `${mostCommonFiller}` : "count",
        tooltip: "Counts common fillers (um, uh, like, you know).",
      },
      {
        key: "talktime",
        label: "Talk time",
        value: `${tilde}${fmtTime(talkTimeSec ?? null)}`,
        suffix: "",
        tooltip: "Estimated talk duration excluding long silences.",
      },
    ];
  }, [wpm, pauseCount, fillerCount, talkTimeSec, mostCommonFiller, approximate]);

  return (
    <div className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)] mb-2">Live Metrics</div>
      <div className="flex flex-wrap gap-2">
        {chips.slice(0, 4).map((c) => (
          <div
            key={c.key}
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--muted-2)] bg-white text-[13px]"
            title={c.tooltip}
            style={{ minWidth: 132 }}
          >
            <span className="text-[color:rgba(11,11,12,0.65)]">{c.label}</span>
            <span className="font-semibold text-[color:var(--ink)]">{c.value}</span>
            {c.suffix && <span className="text-[12px] text-[color:rgba(11,11,12,0.55)]">{c.suffix}</span>}
          </div>
        ))}
        {chips.length === 0 && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-[color:var(--muted-2)] bg-white text-[13px]" style={{ minWidth: 132 }}>
            Initializing…
          </div>
        )}
        {chips.length > 4 && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-[color:var(--muted-2)] bg-white text-[13px]" style={{ minWidth: 72 }} title="More metrics">
            +{chips.length - 4}
          </div>
        )}
      </div>
      {approximate && (
        <div className="mt-2 text-[11px] text-[color:rgba(11,11,12,0.55)]">~ approximate — refines as transcript completes</div>
      )}
    </div>
  );
} 