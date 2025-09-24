"use client";

import React from "react";

export default function MetricsTile({
  talkTimeSec,
  wpm,
  pauseCount,
  fillerCount,
  mostCommonFiller,
}: {
  talkTimeSec?: number | null;
  wpm?: number | null;
  pauseCount?: number | null;
  fillerCount?: number | null;
  mostCommonFiller?: string | null;
}) {
  const fmtTime = (s?: number | null) => {
    const v = typeof s === "number" && isFinite(s) ? Math.max(0, s) : 0;
    const m = Math.floor(v / 60);
    const ss = Math.floor(v % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const Item = ({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) => (
    <div className="flex-1 min-w-[120px] p-4 rounded-[16px] bg-white border border-[color:var(--muted-2)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)]">{label}</div>
      <div className="mt-1 text-[24px] sm:text-[28px] font-extrabold tracking-[-0.01em]" style={{ color: accent || "var(--ink)" }}>{value}</div>
      {hint && <div className="text-[12px] mt-1 text-[color:rgba(11,11,12,0.6)]">{hint}</div>}
    </div>
  );

  const timeStr = fmtTime(talkTimeSec ?? null);
  const wpmStr = typeof wpm === "number" && isFinite(wpm) ? Math.round(wpm).toString() : "—";
  const pausesStr = typeof pauseCount === "number" && isFinite(pauseCount) ? String(pauseCount) : "—";
  const fillerStr = typeof fillerCount === "number" && isFinite(fillerCount) ? String(fillerCount) : "—";
  const commonStr = mostCommonFiller ? `“${mostCommonFiller}”` : "—";

  return (
    <section className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)] mb-2">Basic Metrics</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Item label="Talk time" value={timeStr} hint="Total duration" />
        <Item label="WPM" value={wpmStr} hint="Words per minute" accent="var(--bright-purple)" />
        <Item label="# Pauses" value={pausesStr} hint=">=0.5s gaps" />
        <Item label="# Filler words" value={fillerStr} hint="um, uh, like…" />
        <Item label="Top filler" value={commonStr} hint="Most frequent" />
      </div>
    </section>
  );
} 