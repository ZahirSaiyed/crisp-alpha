"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "../../../lib/sessionStore";
import TranscriptPanel from "../../../components/TranscriptPanel";
import MetricsTile from "../../../components/MetricsTile";
import { detectFillerCounts, detectPauses, WordToken } from "../../../lib/analysis";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const session = getSession(id);

  // Coach status polling (pill) - moved to top to avoid conditional hooks
  const [coachStatus, setCoachStatus] = useState<"pending"|"ready"|"error">("pending");
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!session) router.back();
  }, [session, router]);

  useEffect(() => {
    // Feature flag check - coach functionality disabled for now
    setCoachStatus("error");
    return;
    let canceled = false;
    let attempts = 0;
    setPolling(true);
    const tick = async () => {
      try {
        const res = await fetch(`/api/coach/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (canceled) return;
        const st: "pending"|"ready"|"error" | string = (data?.status as string) || "pending";
        if (st === "ready" || st === "error") {
          setCoachStatus(st as "ready"|"error");
          setPolling(false);
          return;
        }
        attempts += 1;
        if (attempts >= 10) { // ~30s if 3s interval
          setPolling(false);
          return;
        }
        setTimeout(tick, 3000);
      } catch {
        attempts += 1;
        if (attempts >= 10) setPolling(false);
        else setTimeout(tick, 3000);
      }
    };
    setTimeout(tick, 0);
    return () => { canceled = true; };
  }, [id]);

  if (!session) return null;

  const tokens = session.tokens as WordToken[];
  const pauses = detectPauses(tokens, 0.5);
  const talkTimeSec = session.durationSec;
  const minutes = talkTimeSec > 0 ? talkTimeSec / 60 : 0;
  const wpm = minutes > 0 ? tokens.length / minutes : null;
  const fillers = detectFillerCounts(tokens);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F9F9FB] to-white text-[color:var(--ink)]">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <header className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Your Results</h1>
          <p className="text-sm text-[color:rgba(11,11,12,0.65)] mt-1">Insights from your speaking practice</p>
        </div>
        {/* Coach functionality disabled for now */}
        {false && (
          <button type="button" onClick={() => router.push(`/coach/${id}`)} className="px-3 py-2 rounded-full border border-[color:var(--muted-2)] bg-white">
            Coach: {coachStatus === "ready" ? "Ready" : coachStatus === "error" ? "Error" : polling ? "Pending" : "Pending"}
          </button>
        )}
      </header>

      <section className="mx-auto max-w-5xl px-6 grid gap-6 pb-8">
        <MetricsTile
          talkTimeSec={talkTimeSec}
          wpm={wpm}
          pauseCount={pauses.length}
          fillerCount={fillers.total}
          mostCommonFiller={fillers.mostCommon}
          approximate={false}
        />
        <TranscriptPanel tokens={tokens} pauses={pauses} />
      </section>
    </main>
  );
}


