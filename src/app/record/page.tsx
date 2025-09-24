"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import * as Comlink from "comlink";
import { decodeToPCM16kMono } from "../../lib/audio";
import { DeliverySummary, Goal } from "../../lib/delivery";
import { takeaway } from "../../lib/takeaway";
import TranscriptPlayerCard from "../../components/TranscriptPlayerCard";
import PromptSwiper from "../../components/PromptSwiper";
import Recorder from "../../components/recorder";
import MetricsTile from "../../components/MetricsTile";
import { detectFillerCounts, detectPauses, WordToken } from "../../lib/analysis";
import FeedbackTile from "../../components/FeedbackTile";
import PracticeAnswerTile from "../../components/PracticeAnswerTile";

type MetricsRemote = Comlink.Remote<import("../../workers/metrics.worker").MetricsWorker>;

type Paragraph = { text: string; start?: number; end?: number };

type Prompt = { id: string; title: string; subtitle?: string; category?: string; icon?: string };

type Persona = "jobSeeker" | "productManager" | "surprise";

const CATEGORY_ICON: Record<string, string> = {
  Clarity: "🔍",
  Authority: "🏆",
  Calmness: "🌊",
  Engagement: "✨",
  Impact: "🚀",
  Wildcard: "🎲",
};

const PERSONA_LABELS: Record<Persona, { label: string; icon: string; sub: string }> = {
  jobSeeker: { label: "Interview Prep", icon: "👤", sub: "Interview-ready prompts" },
  productManager: { label: "Product manager", icon: "📦", sub: "PM prompts for real meetings" },
  surprise: { label: "Surprise me", icon: "🎲", sub: "Fun & wildcard prompts" },
};

function buildPrompts(persona: Persona): Prompt[] {
  if (persona === "jobSeeker") {
    return [
      { id: "js-clarity-1", title: "Walk me through your resume in under a minute.", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "js-clarity-2", title: "What’s a project you’re most proud of?", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "js-authority-1", title: "Why should we hire you over other candidates?", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "js-authority-2", title: "Tell me about a time you influenced a decision.", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "js-calm-1", title: "Tell me about yourself.", subtitle: "Classic opener — nerves spike here.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
      { id: "js-calm-2", title: "Describe a challenge you faced and how you handled it.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
      { id: "js-engage-1", title: "What excites you about this role?", category: "Engagement", icon: CATEGORY_ICON.Engagement },
      { id: "js-engage-2", title: "Tell me about a time you worked on a team — what was your role?", category: "Engagement", icon: CATEGORY_ICON.Engagement },
      { id: "js-impact-1", title: "Why do you want to work here?", category: "Impact", icon: CATEGORY_ICON.Impact },
      { id: "js-impact-2", title: "Give me your elevator pitch for yourself in 30 seconds.", category: "Impact", icon: CATEGORY_ICON.Impact },
    ];
  }
  if (persona === "productManager") {
    return [
      { id: "pm-clarity-1", title: "What’s the problem your team is solving right now?", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "pm-clarity-2", title: "Can you summarize your roadmap in 60 seconds?", category: "Clarity", icon: CATEGORY_ICON.Clarity },
      { id: "pm-authority-1", title: "What’s your recommendation for next quarter and why?", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "pm-authority-2", title: "How would you convince leadership to prioritize your feature?", category: "Authority", icon: CATEGORY_ICON.Authority },
      { id: "pm-calm-1", title: "Give us a quick status update on your project.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
      { id: "pm-calm-2", title: "Walk me through a recent launch — what went well, what didn’t?", category: "Calmness", icon: CATEGORY_ICON.Calmness },
      { id: "pm-engage-1", title: "How would you explain this feature to a customer?", category: "Engagement", icon: CATEGORY_ICON.Engagement },
      { id: "pm-engage-2", title: "What’s a user story that captures the value of your product?", category: "Engagement", icon: CATEGORY_ICON.Engagement },
      { id: "pm-impact-1", title: "What’s your vision for this product in one sentence?", category: "Impact", icon: CATEGORY_ICON.Impact },
      { id: "pm-impact-2", title: "What’s the one takeaway you want leadership to leave with today?", category: "Impact", icon: CATEGORY_ICON.Impact },
    ];
  }
  // surprise / have fun
  return [
    { id: "fun-clarity-1", title: "Explain TikTok to your grandma in 30 seconds.", category: "Clarity", icon: CATEGORY_ICON.Clarity },
    { id: "fun-clarity-2", title: "Teach me how to make your favorite meal.", category: "Clarity", icon: CATEGORY_ICON.Clarity },
    { id: "fun-authority-1", title: "Convince me why pineapple does (or doesn’t) belong on pizza.", category: "Authority", icon: CATEGORY_ICON.Authority },
    { id: "fun-authority-2", title: "Make the case for dogs vs cats in under a minute.", category: "Authority", icon: CATEGORY_ICON.Authority },
    { id: "fun-calm-1", title: "Describe your perfect weekend as if you’re narrating a calm podcast.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
    { id: "fun-calm-2", title: "Explain how to relax after a stressful day.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
    { id: "fun-engage-1", title: "Tell me the funniest story that ever happened to you (keep it short).", category: "Engagement", icon: CATEGORY_ICON.Engagement },
    { id: "fun-engage-2", title: "Describe a movie plot really badly and make me guess it.", category: "Engagement", icon: CATEGORY_ICON.Engagement },
    { id: "fun-impact-1", title: "Give me your motivational one-liner for today.", category: "Impact", icon: CATEGORY_ICON.Impact },
    { id: "fun-impact-2", title: "What’s one life tip you’d shout from a rooftop?", category: "Impact", icon: CATEGORY_ICON.Impact },
    { id: "fun-wild-1", title: "Pick any random object near you and pitch it like it’s the next big startup.", category: "Wildcard", icon: CATEGORY_ICON.Wildcard },
    { id: "fun-wild-2", title: "Pretend you’re introducing yourself to aliens — what do you say?", category: "Wildcard", icon: CATEGORY_ICON.Wildcard },
  ];
}

export default function RecordPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coreSummary, setCoreSummary] = useState<Partial<DeliverySummary> | null>(null);
  const [tokens, setTokens] = useState<Array<{ word: string; start?: number; end?: number }> | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [persona, setPersona] = useState<Persona>("jobSeeker");
  const workerRef = useRef<Worker | null>(null);
  const metricsApiRef = useRef<MetricsRemote | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const computeInFlightRef = useRef<boolean>(false);

  const personaPrompts = useMemo(() => buildPrompts(persona), [persona]);

  useEffect(() => {
    setSelectedPrompt(personaPrompts[0] ?? null);
  }, [personaPrompts]);

  // Keyboard shortcuts for persona tabs: 1/2/3
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "1") setPersona("jobSeeker");
      if (e.key === "2") setPersona("productManager");
      if (e.key === "3") setPersona("surprise");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function ensureWorker(): MetricsRemote | null {
    if (!workerRef.current) {
      const w = new Worker(new URL("../../workers/metrics.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = w;
      metricsApiRef.current = Comlink.wrap<import("../../workers/metrics.worker").MetricsWorker>(w);
    }
    return metricsApiRef.current;
  }

  async function startCompute(url: string) {
    try {
      computeInFlightRef.current = true;
      const res = await fetch(url);
      const blob = await res.blob();
      const { pcm, sampleRate, durationSec } = await decodeToPCM16kMono(blob);
      const api = ensureWorker();
      if (!api) throw new Error("Worker unavailable");
      const summary = await api.computeCoreFromPcm(pcm, sampleRate);
      const delivery: Partial<DeliverySummary> = {
        endRushIndex: summary.endRushIndexApprox ?? 0,
        pauses: summary.pauseEvents,
        durationSec,
      } as Partial<DeliverySummary>;
      setCoreSummary(delivery);
      setDurationSec(durationSec);
    } finally {
      computeInFlightRef.current = false;
    }
  }

  const handlePhaseChange = useCallback((p: string) => {
    if (p !== "ready") return;
    const audioEl = document.querySelector('audio[src^="blob:"]') as HTMLAudioElement | null;
    const url = audioEl?.src || null;
    if (!url) return;
    if (lastUrlRef.current === url || computeInFlightRef.current) return;
    lastUrlRef.current = url;
    setAudioUrl(url);
    startCompute(url);
  }, []);

  const goal: Goal = "Authority";
  const fullSummary = coreSummary as DeliverySummary | null;
  const insight = fullSummary ? takeaway(fullSummary, goal) : null;
  const [aiCoach, setAiCoach] = useState<{ headline?: string; subtext?: string } | null>(null);
  const [aiPractice, setAiPractice] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const words = Array.isArray(tokens) ? tokens : [];
  const pauseEvents = Array.isArray(words) && words.length > 0 ? detectPauses(words as WordToken[], 0.5) : (coreSummary?.pauses || []);
  const talkTimeSec = typeof durationSec === "number" ? durationSec : (words.length > 0 ? Math.max(...words.map(w => (w.end ?? w.start) || 0)) : null);
  const wpm = (() => {
    const totalWords = words.length;
    const minutes = typeof talkTimeSec === "number" && talkTimeSec > 0 ? talkTimeSec / 60 : 0;
    return minutes > 0 ? totalWords / minutes : null;
  })();
  const fillers = detectFillerCounts(words);

  const essentialsReady = Boolean(audioUrl && (insight || aiCoach) && typeof talkTimeSec === "number" && !feedbackLoading);

  return (
    <main className="min-h-screen bg-white text-[color:var(--ink)]">
      {/* Hidden recorder to handle programmatic start/stop. UI suppressed via props and visually hidden wrapper. */}
      <div className="hidden">
        <Recorder
          stickyMobileCTA={false}
          appearance="onLight"
          disableLegacyResults={true}
          onPhaseChange={handlePhaseChange}
          onTranscript={({ transcript, words, paragraphs, durationSec }) => {
            setTokens(words ?? null);
            setParagraphs(paragraphs ?? null);
            setRawTranscript(typeof transcript === "string" ? transcript : null);
            if (typeof durationSec === "number") setDurationSec(durationSec);
          }}
        />
      </div>

      {!audioUrl && (
        <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] flex flex-col items-stretch justify-center gap-5 py-8">
          {/* Persona tabs */}
          <div role="tablist" aria-label="Personas" className="mx-auto w-full max-w-[560px] flex items-center justify-center gap-2">
            {(["jobSeeker","productManager","surprise"] as Persona[]).map((key) => {
              const active = persona === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersona(key)}
                  className={`px-4 py-2 text-[13px] font-medium rounded-full transition transform ${active ? "bg-[color:var(--ink)] text-white" : "bg-[color:var(--muted-1)] text-[color:rgba(11,11,12,0.8)] hover:bg-[color:var(--muted-1)]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bright-purple)]"}`}
                >
                  <span className="mr-1">{PERSONA_LABELS[key as Persona].icon}</span>
                  {PERSONA_LABELS[key as Persona].label}
                </button>
              );
            })}
          </div>
          <div className="mx-auto w-full max-w-[560px] -mt-1 text-center text-[12px] text-[color:rgba(11,11,12,0.55)]">
            {PERSONA_LABELS[persona].sub}
          </div>

          <PromptSwiper key={`ps-${persona}`} prompts={personaPrompts} onSelect={(p) => setSelectedPrompt(p)} />
        </section>
      )}

      {audioUrl && (
        <section className="relative mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 gap-6">
          {!essentialsReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="w-full h-full rounded-[20px] bg-white/80 backdrop-blur flex items-center justify-center">
                <div className="flex items-center gap-3 text-[14px] text-[color:rgba(11,11,12,0.7)]">
                  <span className="inline-block w-5 h-5 rounded-full border-2 border-[color:var(--muted-2)] border-t-[color:var(--bright-purple)] animate-spin" />
                  Preparing your insights…
                </div>
              </div>
            </div>
          )}

          {(aiCoach || insight) && (
            <div className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)] mb-2">Coach Insight</div>
              <div className="text-[22px] sm:text-[26px] font-extrabold leading-snug tracking-[-0.01em]">{aiCoach?.headline || insight?.headline}</div>
              <div className="text-sm sm:text-base mt-2 text-[color:rgba(11,11,12,0.75)]">{aiCoach?.subtext || insight?.subtext}</div>
              {selectedPrompt && (
                <div className="mt-3 text-xs text-[color:rgba(11,11,12,0.55)]">Prompt: {selectedPrompt.title}</div>
              )}
            </div>
          )}
          <MetricsTile
            talkTimeSec={talkTimeSec}
            wpm={wpm}
            pauseCount={pauseEvents?.length || 0}
            fillerCount={fillers.total}
            mostCommonFiller={fillers.mostCommon}
          />
          <TranscriptPlayerCard src={audioUrl} tokens={tokens} paragraphs={paragraphs} transcript={rawTranscript} />
          <PracticeAnswerTile answer={aiPractice} />
          <FeedbackTile
            transcript={rawTranscript}
            tokens={tokens as WordToken[] | null}
            onStructured={(s) => {
              if (s?.coachInsight) setAiCoach({ headline: s.coachInsight.headline, subtext: s.coachInsight.subtext });
              if (typeof s?.improvedAnswer === "string") setAiPractice(s.improvedAnswer);
            }}
            onLoadingChange={(v) => setFeedbackLoading(Boolean(v))}
          />
        </section>
      )}
    </main>
  );
} 