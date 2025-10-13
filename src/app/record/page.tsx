"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import * as Comlink from "comlink";
import { decodeToPCM16kMono } from "../../lib/audio";
import { DeliverySummary, Goal } from "../../lib/delivery";
import TranscriptPlayerCard from "../../components/TranscriptPlayerCard";
import PromptSwiper from "../../components/PromptSwiper";
import Recorder, { RecorderHandle } from "../../components/recorder";
import MetricsTile from "../../components/MetricsTile";
import { detectFillerCounts, detectPauses, WordToken } from "../../lib/analysis";
import FeedbackTile from "../../components/FeedbackTile";
import PracticeAnswerTile from "../../components/PracticeAnswerTile";
import LoadingOverlay from "../../components/LoadingOverlay";

type MetricsRemote = Comlink.Remote<import("../../workers/metrics.worker").MetricsWorker>;

type Paragraph = { text: string; start?: number; end?: number };

type Prompt = { id: string; title: string; subtitle?: string | undefined; category?: string | undefined; icon?: string | undefined };

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
      { id: "js-calm-1", title: "Tell me about yourself.", category: "Calmness", icon: CATEGORY_ICON.Calmness },
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
  const recorderRef = useRef<RecorderHandle | null>(null);
  const currentPhaseRef = useRef<string>("idle");
  const [isRecording, setIsRecording] = useState(false);

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

  const startCompute = useCallback(async (url: string, blob: Blob) => {
    try {
      console.warn('🎯 startCompute called with URL:', url, 'and blob size:', blob.size);
      computeInFlightRef.current = true;
      
      // Validate inputs
      if (!url || typeof url !== 'string' || !url.startsWith('blob:')) {
        throw new Error('Invalid blob URL provided');
      }
      if (!blob || blob.size === 0) {
        throw new Error('Invalid or empty blob provided');
      }
      
      console.warn('🔊 Decoding audio...');
      const { pcm, sampleRate, durationSec } = await decodeToPCM16kMono(blob);
      console.warn('✅ Audio decoded, duration:', durationSec);
      
      // Set duration immediately so overlay can hide
      setDurationSec(durationSec);
      
      try {
        console.warn('👷 Ensuring worker...');
        const api = ensureWorker();
        if (!api) throw new Error("Worker unavailable");
        console.warn('✅ Worker available');
        
        console.warn('🧮 Computing metrics...');
        const summary = await api.computeCoreFromPcm(pcm, sampleRate);
      console.warn('✅ Metrics computed');
        
        const delivery: Partial<DeliverySummary> = {
          endRushIndex: summary.endRushIndexApprox ?? 0,
          pauses: summary.pauseEvents,
          durationSec,
        } as Partial<DeliverySummary>;
        
        console.warn('💾 Setting core summary...');
        setCoreSummary(delivery);
      } catch (workerError) {
        console.warn('⚠️ Worker failed, continuing without advanced metrics:', workerError);
        // Set a minimal summary so the app doesn't get stuck
        const delivery: Partial<DeliverySummary> = {
          endRushIndex: 0,
          pauses: [],
          durationSec,
        } as Partial<DeliverySummary>;
        setCoreSummary(delivery);
      }
      
      console.warn('✅ State updated successfully');
    } catch (error) {
      console.error('❌ Audio processing failed:', error);
      // Set minimal state to prevent getting stuck
      setDurationSec(0);
      setCoreSummary({ endRushIndex: 0, pauses: [], durationSec: 0 });
    } finally {
      computeInFlightRef.current = false;
      console.warn('🏁 startCompute finished');
    }
  }, []);

  const handlePhaseChange = useCallback((p: string) => {
    console.warn('🔄 Phase changed to:', p);
    currentPhaseRef.current = p;
  }, []);

  const handleBlobUrlChange = useCallback((url: string | null, blob: Blob | null | undefined) => {
    console.warn('🔍 handleBlobUrlChange called with:', url, 'blob:', blob);
    console.warn('🔍 Current phase:', currentPhaseRef.current);
    console.warn('🔍 Last URL:', lastUrlRef.current);
    console.warn('🔍 Compute in flight:', computeInFlightRef.current);
    
    if (!url || !blob || lastUrlRef.current === url || computeInFlightRef.current) {
      console.warn('🔍 Early return - conditions not met');
      return;
    }
    if (currentPhaseRef.current !== "ready") {
      console.warn('🔍 Early return - phase not ready');
      return;
    }
    
    console.warn('🚀 Starting compute with URL:', url, 'and blob');
    lastUrlRef.current = url;
    setAudioUrl(url);
    startCompute(url, blob);
  }, [startCompute]);

  const goal: Goal = "Authority";
  const fullSummary = coreSummary as DeliverySummary | null;
  const [aiCoach, setAiCoach] = useState<{ headline?: string | undefined; subtext?: string | undefined } | null>(null);
  const [aiPractice, setAiPractice] = useState<string | null>(null);
  // Track external loading states only for side-effects (no render dependency)

  const words = useMemo(() => (Array.isArray(tokens) ? tokens : []), [tokens]);
  const pauseEvents = Array.isArray(words) && words.length > 0 ? detectPauses(words as WordToken[], 0.5) : (coreSummary?.pauses || []);
  const talkTimeSec = typeof durationSec === "number" ? durationSec : (words.length > 0 ? Math.max(...words.map(w => (w.end ?? w.start) || 0)) : null);
  const wpm = (() => {
    const totalWords = words.length;
    const minutes = typeof talkTimeSec === "number" && talkTimeSec > 0 ? talkTimeSec / 60 : 0;
    return minutes > 0 ? totalWords / minutes : null;
  })();
  const fillers = detectFillerCounts(words);
  const approximate = useMemo(() => {
    const hasFinalDuration = typeof durationSec === "number" && durationSec > 0;
    const hasWordTimings = words.some((w) => typeof w.end === "number");
    return !(hasFinalDuration && hasWordTimings);
  }, [durationSec, words]);

  // Smart overlay visibility: show immediately on load start; hide with a tiny delay to avoid flicker
  const [overlayVisible, setOverlayVisible] = useState(false);
  // Consider overlay only until we can show transcript or any metric
  const hasAnyMetrics = Boolean(
    (typeof talkTimeSec === "number" && talkTimeSec > 0) ||
    (Array.isArray(tokens) && tokens.length > 0) ||
    (typeof rawTranscript === "string" && rawTranscript.trim().length > 0)
  );

  // Debug metrics
  console.warn('📊 Metrics debug:', {
    talkTimeSec,
    tokensLength: tokens?.length,
    rawTranscriptLength: rawTranscript?.length,
    hasAnyMetrics,
    audioUrl: !!audioUrl,
    overlayVisible
  });

  useEffect(() => {
    const shouldShow = Boolean(audioUrl) && !hasAnyMetrics;
    if (shouldShow) {
      setOverlayVisible(true);
      // Fallback: hide overlay after 10 seconds to prevent getting stuck
      const fallbackTimeout = window.setTimeout(() => {
        console.warn('⚠️ Overlay timeout - hiding after 10 seconds');
        setOverlayVisible(false);
      }, 10000);
      return () => window.clearTimeout(fallbackTimeout);
    }
    const t = window.setTimeout(() => setOverlayVisible(false), 160);
    return () => window.clearTimeout(t);
  }, [audioUrl, hasAnyMetrics]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F9F9FB] to-white text-[color:var(--ink)]">
      {/* Hidden recorder to handle programmatic start/stop. UI suppressed via props and visually hidden wrapper. */}
      <div className="mx-auto w-full max-w-[560px]">
        <Recorder
          ref={recorderRef}
          stickyMobileCTA={true}
          appearance="onLight"
          disableLegacyResults={true}
          showUI={false}
          onPhaseChange={(p) => { handlePhaseChange(p); setIsRecording(p === "recording"); }}
          onBlobUrlChange={handleBlobUrlChange}
          onTranscript={({ transcript, words, paragraphs, durationSec }) => {
            setTokens(words ?? null);
            setParagraphs(paragraphs ?? null);
            setRawTranscript(typeof transcript === "string" ? transcript : null);
            if (typeof durationSec === "number") setDurationSec(durationSec);
          }}
        />
      </div>

      {!audioUrl && (
        <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] flex flex-col items-stretch justify-center gap-3 py-8">
          {/* Persona tabs */}
          <div role="tablist" aria-label="Personas" className="mx-auto w-full max-w-[640px] flex items-center justify-center gap-1.5">
            {(["jobSeeker","productManager","surprise"] as Persona[]).map((key) => {
              const active = persona === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersona(key)}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[12px] sm:text-[13px] font-medium rounded-full transition-all duration-200 transform hover:scale-105 ${active ? "bg-[color:var(--bright-purple)] text-white shadow-[0_4px_12px_rgba(122,92,255,0.25)]" : "bg-white border border-[color:var(--muted-2)] text-[color:rgba(11,11,12,0.8)] hover:border-[color:var(--bright-purple)]/30 hover:shadow-[0_2px_8px_rgba(122,92,255,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bright-purple)]"}`}
                >
                  <span className="mr-1 sm:mr-1.5">{PERSONA_LABELS[key as Persona].icon}</span>
                  {PERSONA_LABELS[key as Persona].label}
                </button>
              );
            })}
          </div>
          <div className="mx-auto w-full max-w-[640px] -mt-1 mb-1 text-center text-[12px] text-[color:rgba(11,11,12,0.55)]">
            {PERSONA_LABELS[persona].sub}
          </div>

          <PromptSwiper key={`ps-${persona}`} prompts={personaPrompts} onSelect={(p) => setSelectedPrompt(p)} />
          {/* Primary recording control: shown directly below the prompt for HCI clarity */}
          <div className="mx-auto w-full max-w-[640px] flex flex-col items-center gap-2 -mt-1">
            {!isRecording ? (
              <button
                type="button"
                aria-label="Start recording"
                onClick={() => recorderRef.current?.start()}
                className="rec-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
              >
                <style jsx>{`
                  .rec-btn {
                    position: relative;
                    width: 56px;
                    height: 56px;
                    border-radius: 9999px;
                    background: #ef4444; /* red-600 */
                    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms, background-color 180ms;
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4), 0 2px 8px rgba(239, 68, 68, 0.15);
                  }
                  .rec-btn:hover { 
                    transform: scale(1.08);
                    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.1), 0 12px 28px rgba(239, 68, 68, 0.35), 0 4px 12px rgba(239, 68, 68, 0.2);
                    background: #f05252; /* red-500 */
                  }
                  .rec-btn::after {
                    content: "";
                    position: absolute;
                    inset: -8px;
                    border-radius: inherit;
                    border: 2px solid rgba(122, 92, 255, 0.3);
                    opacity: 0;
                    transform: scale(0.9);
                    transition: opacity 200ms, transform 200ms;
                  }
                  .rec-btn:hover::after { opacity: 1; transform: scale(1); }
                `}</style>
                <style jsx>{`
                  @keyframes pulse-ring { from { transform: scale(1); opacity: 0.45; } to { transform: scale(1.5); opacity: 0; } }
                `}</style>
                <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 0 rgba(239,68,68,0.5)", animation: "pulse-ring 1.6s ease-out infinite" }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => recorderRef.current?.stop()}
                aria-pressed
                className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-full text-base sm:text-lg font-semibold bg-red-600 text-white shadow-[0_10px_22px_rgba(239,68,68,0.28),_0_2px_6px_rgba(239,68,68,0.18)] hover:bg-red-500"
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="white"/></svg>
                  Stop
                </span>
              </button>
            )}
            <span className="text-xs text-[color:rgba(11,11,12,0.6)]" aria-live="polite">{isRecording ? "Recording…" : "Ready when you are"}</span>
          </div>

          {/* Single, canonical recording control is handled by the embedded <Recorder /> via ref. */}
        </section>
      )}

      {audioUrl && (
        <section className="relative mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 gap-6">
          <LoadingOverlay show={overlayVisible} label="Preparing your insights…" />

          {aiCoach && (
            <div className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--bright-purple)] mb-2 font-medium">Coach Insight</div>
              <div className="text-[22px] sm:text-[26px] font-extrabold leading-snug tracking-[-0.01em]">{aiCoach.headline}</div>
              <div className="text-sm sm:text-base mt-2 text-[color:rgba(11,11,12,0.75)]">{aiCoach.subtext}</div>
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
            approximate={approximate}
          />
          <TranscriptPlayerCard src={audioUrl} tokens={tokens} paragraphs={paragraphs} transcript={rawTranscript} />
          <PracticeAnswerTile answer={aiPractice} />
          <FeedbackTile
            transcript={rawTranscript}
            tokens={tokens as WordToken[] | null}
            onStructured={(s) => {
              if (s?.coachInsight) {
                const { headline, subtext } = s.coachInsight;
                setAiCoach({ 
                  ...(headline !== undefined && { headline }), 
                  ...(subtext !== undefined && { subtext }) 
                });
              }
              if (typeof s?.improvedAnswer === "string") setAiPractice(s.improvedAnswer);
            }}
          />
          
          {/* Privacy disclaimer */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs text-gray-600 text-center">
              🔒 Your audio was securely processed and immediately discarded. Nothing is stored.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}


