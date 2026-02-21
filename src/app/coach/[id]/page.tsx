"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CoachPayload = {
  one_liner?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  confidence?: number;
};

export default function CoachPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [status, setStatus] = useState<"pending"|"ready"|"error">("pending");
  const [coach, setCoach] = useState<CoachPayload | null>(null);

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const res = await fetch(`/api/coach/${id}`, { cache: "no-store" });
        const data: { status?: "pending"|"ready"|"error"; coach?: CoachPayload } = await res.json();
        if (canceled) return;
        setStatus(data?.status ?? "pending");
        if (data?.coach) setCoach(data.coach);
      } catch {
        if (!canceled) setStatus("error");
      }
    }
    load();
    return () => { canceled = true; };
  }, [id]);

  return (
    <main className="min-h-screen bg-[var(--bg-warm)] text-[var(--ink)]">
      <head>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <header className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Coach</h1>
          <p className="text-sm text-[var(--ink-light)]">Personalized feedback</p>
        </div>
        <button type="button" onClick={() => router.push(`/results/${id}`)} className="px-3 py-2 rounded-full border border-[var(--muted-2)] bg-white text-[var(--ink)] hover:border-[var(--ink-light)] transition-colors">Back to results</button>
      </header>
      <section className="mx-auto max-w-5xl px-6 grid gap-4">
        {status === "pending" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--muted-2)] bg-white p-4 text-[var(--ink-light)]">Coach is preparing…</div>
        )}
        {status === "error" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--muted-2)] bg-white p-4 text-[var(--bad)]">Error loading coach. Try again later.</div>
        )}
        {status === "ready" && coach && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--muted-2)] bg-white p-4">
            {coach.one_liner && <div className="text-lg font-semibold text-[var(--ink)] mb-2">{coach.one_liner}</div>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="font-medium text-[var(--ink)] mb-1">Strengths</div>
                <ul className="list-disc list-inside text-sm text-[var(--ink-light)]">
                  {(coach.strengths || []).map((s, i) => (<li key={`s-${i}`}>{s}</li>))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-[var(--ink)] mb-1">Weaknesses</div>
                <ul className="list-disc list-inside text-sm text-[var(--ink-light)]">
                  {(coach.weaknesses || []).map((s, i) => (<li key={`w-${i}`}>{s}</li>))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-[var(--ink)] mb-1">Recommendations</div>
                <ul className="list-disc list-inside text-sm text-[var(--ink-light)]">
                  {(coach.recommendations || []).map((s, i) => (<li key={`r-${i}`}>{s}</li>))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}


