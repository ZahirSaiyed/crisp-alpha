"use client";

import React from "react";

export default function PracticeAnswerTile({ answer }: { answer?: string | null }) {
  if (!answer || answer.trim().length === 0) return null;
  return (
    <section className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)] mb-2">Practice Answer</div>
      <div className="text-[15px] sm:text-[16px] leading-7 sm:leading-8 text-[color:rgba(11,11,12,0.9)] whitespace-pre-wrap">
        {answer}
      </div>
    </section>
  );
} 