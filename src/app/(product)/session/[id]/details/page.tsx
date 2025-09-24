"use client";

import React, { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "../../../../../lib/sessionStore";
import TimelineStrip from "../../../../../components/TimelineStrip";
import TranscriptPanel from "../../../../../components/TranscriptPanel";
import { detectPauses } from "../../../../../lib/analysis";

export default function DetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const session = getSession(id);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!session) router.back();
  }, [session, router]);

  if (!session) return null;

  const pauses = detectPauses(session.tokens, 0.5);

  return (
    <main className="min-h-screen text-[color:var(--ink)]">
      <header className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Detailed Feedback</h1>
          <p className="text-sm text-[color:rgba(11,11,12,0.65)]">Based on your last recording — explore delivery patterns over time.</p>
        </div>
        <button type="button" onClick={() => router.back()} className="px-3 py-2 rounded-full border border-[color:var(--muted-2)] bg-white">Close</button>
      </header>

      <section className="mx-auto max-w-5xl px-6 mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-[color:rgba(11,11,12,0.7)]">Timeline</span>
          <div className="text-xs text-[color:rgba(11,11,12,0.7)]">Simple | Advanced</div>
        </div>
        <TimelineStrip tokens={session.tokens} durationSec={session.durationSec} onSeek={(t) => { if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play().catch(()=>{}); } }} />
      </section>

      <section className="mx-auto max-w-5xl px-6 mt-6 grid grid-cols-1 gap-4">
        <TranscriptPanel tokens={session.tokens} pauses={pauses} onSeek={(t) => { if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play().catch(()=>{}); } }} />
      </section>

      <audio ref={audioRef} src={session.audioUrl} controls className="fixed inset-x-0 bottom-0 w-full bg-white/80 backdrop-blur border-t border-[color:var(--muted-2)]" />
    </main>
  );
} 