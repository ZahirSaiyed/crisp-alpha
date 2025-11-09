"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import * as Comlink from "comlink";
import { decodeToPCM16kMono } from "../../lib/audio";
import { DeliverySummary } from "../../lib/delivery";
import TranscriptPlayerCard from "../../components/TranscriptPlayerCard";
import PromptBoard from "../../components/PromptBoard";
import Recorder, { RecorderHandle } from "../../components/recorder";
import MetricsTile from "../../components/MetricsTile";
import { detectFillerCounts, detectPauses, WordToken } from "../../lib/analysis";
import FeedbackTile from "../../components/FeedbackTile";
import PracticeAnswerTile from "../../components/PracticeAnswerTile";
import LoadingOverlay from "../../components/LoadingOverlay";
import ProgressPreview from "../../components/ProgressPreview";
import { buildSessionMetrics } from "../../lib/metrics";
import { useAuth } from "../../contexts/AuthContext";
import posthog from "posthog-js";
import ScenarioInput, { type Intent } from "../../components/ScenarioInput";
import { applyIntentTheme, removeIntentTheme, getIntentLabel, getIntentTheme, hexToRgba } from "../../lib/intentTheme";

type MetricsRemote = Comlink.Remote<import("../../workers/metrics.worker").MetricsWorker>;

type Paragraph = { text: string; start?: number; end?: number };

type Prompt = { id: string; title: string; subtitle?: string | undefined; category?: string | undefined; icon?: string | undefined };


export default function RecordPage() {
  const { user } = useAuth();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coreSummary, setCoreSummary] = useState<Partial<DeliverySummary> | null>(null);
  const [tokens, setTokens] = useState<Array<{ word: string; start?: number; end?: number }> | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<Prompt[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const metricsApiRef = useRef<MetricsRemote | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const computeInFlightRef = useRef<boolean>(false);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const currentPhaseRef = useRef<string>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [freestyleText, setFreestyleText] = useState<string | undefined>(undefined);

  // Don't auto-select first prompt - let user choose

  // Apply intent theme when intent changes
  useEffect(() => {
    if (intent) {
      applyIntentTheme(intent);
    }
    return () => {
      removeIntentTheme();
    };
  }, [intent]);

  // Initialize or retrieve anonymous ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let id = localStorage.getItem('crisp_anon_id');
    if (!id) {
      // Generate new UUID
      id = crypto.randomUUID();
      localStorage.setItem('crisp_anon_id', id);
    }
    setAnonId(id);
  }, []);

  // Check for URL params and use stored prompts or generate if coming from landing page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (scenario || intent || generatedPrompts.length > 0 || isGeneratingPrompts) return; // Already have data or generating
    
    const searchParams = new URLSearchParams(window.location.search);
    const scenarioParam = searchParams.get('scenario');
    const intentParam = searchParams.get('intent') as Intent | null;
    
    if (scenarioParam && intentParam && ['decisive', 'natural', 'calm', 'persuasive', 'empathetic'].includes(intentParam)) {
      // Check if prompts were already generated on landing page
      const storedPrompts = sessionStorage.getItem('crisp_generated_prompts');
      const storedSource = sessionStorage.getItem('crisp_prompt_source');
      
      if (storedPrompts) {
        try {
          const prompts = JSON.parse(storedPrompts);
          if (Array.isArray(prompts) && prompts.length > 0) {
            setScenario(scenarioParam);
            setIntent(intentParam);
            setGeneratedPrompts(prompts);
            
            posthog.capture('prompt_generation_success', {
              source: storedSource || 'unknown',
              scenario_length: scenarioParam.length,
              intent: intentParam,
              from_storage: true,
            });
            
            // Clean up storage and URL params
            sessionStorage.removeItem('crisp_generated_prompts');
            sessionStorage.removeItem('crisp_prompt_source');
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            return;
          }
        } catch (error) {
          console.error('Failed to parse stored prompts:', error);
        }
      }
      
      // If no stored prompts, generate them
      handleGeneratePrompts(scenarioParam, intentParam);
      
      // Clean up URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Generate idempotency key
  const generateIdempotencyKey = useCallback(async (scenario: string, intent: Intent) => {
    const text = `${scenario}:${intent}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  // Handle prompt generation
  const handleGeneratePrompts = useCallback(async (scenarioText: string, intentValue: Intent) => {
    setScenario(scenarioText);
    setIntent(intentValue);
    setIsGeneratingPrompts(true);

    try {
      const idempotencyKey = await generateIdempotencyKey(scenarioText, intentValue);

      const response = await fetch('/api/prompts/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioText,
          intent: intentValue,
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate prompts: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data.prompts) && data.data.prompts.length > 0) {
        setGeneratedPrompts(data.data.prompts);
        posthog.capture('prompt_generation_success', {
          source: data.data.source,
          scenario_length: scenarioText.length,
          intent: intentValue,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Failed to generate prompts:', error);
      // Even if API fails, try to get fallback prompts
      // The API should always return something, but if fetch itself fails, we need a client-side fallback
      try {
        // Try one more time without idempotency to get fallback
        const fallbackResponse = await fetch('/api/prompts/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: scenarioText,
            intent: intentValue,
          }),
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.data && Array.isArray(fallbackData.data.prompts)) {
            setGeneratedPrompts(fallbackData.data.prompts);
            posthog.capture('prompt_generation_fallback', {
              scenario_length: scenarioText.length,
              intent: intentValue,
            });
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        posthog.capture('prompt_generation_failed', {
          scenario_length: scenarioText.length,
          intent: intentValue,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [generateIdempotencyKey]);

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

  const [aiCoach, setAiCoach] = useState<{ headline?: string | undefined; subtext?: string | undefined } | null>(null);
  const [aiPractice, setAiPractice] = useState<string | null>(null);
  
  // Handle session migration when user signs in
  const handleSignIn = useCallback(async () => {
    if (!anonId) return;
    
    try {
      const response = await fetch('/api/sessions/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon_id: anonId }),
      });

      if (response.ok) {
        const data = await response.json();
        const migrated = data.migrated || 0;
        if (migrated > 0) {
          // Clear anon ID after migration
          localStorage.removeItem('crisp_anon_id');
          setAnonId(null);
        }
      }
    } catch (error) {
      console.error('Failed to migrate sessions:', error);
    }
  }, [anonId]);
  
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

  // Track when results are displayed
  useEffect(() => {
    if (audioUrl && hasAnyMetrics) {
      posthog.capture('viewed_results', {
        session_id: audioUrl, // Using audioUrl as session identifier
        duration_sec: durationSec,
        word_count: tokens?.length || 0,
        scenario: scenario,
        intent: intent,
        prompt_id: selectedPrompt?.id,
        prompt_title: selectedPrompt?.title
      });
    }
  }, [audioUrl, hasAnyMetrics, durationSec, tokens, scenario, intent, selectedPrompt]);

  // Handle prompt selection (for highlighting)
  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    setSelectedPrompt(prompt);
  }, []);

  // Handle practice button click - start recording with brief preparation
  const handlePracticePrompt = useCallback((prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsPreparing(true);
    
    const startRecording = () => {
      posthog.capture('prompt_accepted', {
        prompt_id: prompt.id,
        prompt_title: prompt.title,
        scenario: scenario,
        intent: intent,
      });
      recorderRef.current?.start();
    };
    
    // Brief preparation, then start recording
    setTimeout(() => {
      setIsPreparing(false);
      startRecording();
    }, 1000);
  }, [scenario, intent]);

  // Handle freestyle practice
  const handleFreestylePractice = useCallback(() => {
    setSelectedPrompt({ id: 'freestyle', title: scenario || 'Freestyle practice' }); // Set freestyle as selected
    setIsPreparing(true);
    
    const startRecording = () => {
      posthog.capture('freestyle_recording_started', {
        scenario: scenario,
        intent: intent,
      });
      recorderRef.current?.start();
    };
    
    // Brief preparation, then start recording
    setTimeout(() => {
      setIsPreparing(false);
      startRecording();
    }, 1000);
  }, [scenario, intent]);


  // Save session metrics when we have complete data
  useEffect(() => {
    if (!hasAnyMetrics || !durationSec || !tokens || tokens.length === 0) return;
    if (!wpm || wpm === null) return;

    // Build session metrics from calculated values
    const sessionMetrics = buildSessionMetrics({
      wpm: wpm,
      fillerCount: fillers.total,
      totalWords: tokens.length,
      pauseCount: pauseEvents.length,
      talkTimeSec: durationSec,
    });

    // Save to API (works for both anonymous and authenticated users)
    // Only save after user has recorded (prompt accepted)
    async function saveSession() {
      try {
        const payload = {
          ...sessionMetrics,
          ...(user ? {} : { anon_id: anonId }), // Anonymous users include anon_id
          ...(scenario ? { scenario } : {}),
          ...(intent ? { intent } : {}),
          ...(freestyleText ? { freestyle_text: freestyleText } : {}),
          ...(selectedPrompt ? { prompt_id: selectedPrompt.id, prompt_title: selectedPrompt.title } : { is_freestyle: true }),
        };

        const response = await fetch('/api/sessions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          posthog.capture('session_created', {
            session_id: data.data?.session_id,
            scenario: scenario,
            intent: intent,
            duration_sec: durationSec,
          });
        } else {
          const error = await response.json();
          console.error('❌ Failed to save session:', response.status, error);
        }
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }

    saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyMetrics, durationSec, tokens?.length, wpm, user, anonId, scenario, intent]);

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
          onPhaseChange={(p) => { 
            handlePhaseChange(p); 
            setIsRecording(p === "recording");
            // Clear preparation state when recording starts
            if (p === "recording") {
              setIsPreparing(false);
            }
          }}
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
          {generatedPrompts.length === 0 ? (
            <>
              {/* Scenario input - shown before prompts are generated */}
              <ScenarioInput onGenerate={handleGeneratePrompts} isLoading={isGeneratingPrompts} />
            </>
          ) : (
            <>
                {/* Scenario + Intent header */}
                {scenario && intent && (
                  <div className="mx-auto w-full max-w-[640px] mb-6">
                    <div className="text-center mb-4">
                      <p className="text-base sm:text-lg text-[color:rgba(11,11,12,0.75)] leading-relaxed">
                        Let's help you sound more <span className="font-semibold text-[color:var(--intent-primary)]">{getIntentLabel(intent)}</span> for your <span className="font-semibold">{scenario}</span>.
                      </p>
                    </div>
                    {/* Start/Stop button - appears when a prompt is selected */}
                    {selectedPrompt && intent && (() => {
                      const theme = getIntentTheme(intent);
                      const primaryColor = theme?.primary || "#7C3AED";
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="flex flex-col items-center gap-2"
                        >
                          {isPreparing ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="px-8 py-3.5 rounded-2xl text-sm font-medium text-[color:rgba(11,11,12,0.70)]"
                            >
                              <span>Getting ready...</span>
                            </motion.div>
                          ) : !isRecording ? (
                            <motion.button
                              type="button"
                              onClick={() => {
                                if (selectedPrompt.id === 'freestyle') {
                                  handleFreestylePractice();
                                } else {
                                  handlePracticePrompt(selectedPrompt);
                                }
                              }}
                              whileHover={{ 
                                scale: 1.05,
                                x: 4,
                              }}
                              whileTap={{ scale: 0.98 }}
                              className="group px-8 py-3.5 rounded-2xl text-sm font-medium text-white transition-all duration-250 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 flex items-center justify-center gap-2"
                              style={{ 
                                backgroundColor: primaryColor,
                                boxShadow: `0 4px 20px ${hexToRgba(primaryColor, 0.4)}`,
                              }}
                            >
                              <span>Start practice</span>
                              <motion.svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                animate={{
                                  x: [0, 3, 0],
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </motion.svg>
                            </motion.button>
                          ) : (
                            <motion.button
                              type="button"
                              onClick={() => recorderRef.current?.stop()}
                              whileHover={{ 
                                scale: 1.05,
                              }}
                              whileTap={{ scale: 0.98 }}
                              className="px-8 py-3.5 rounded-2xl text-sm font-medium text-white transition-all duration-250 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 flex items-center justify-center gap-2"
                              style={{ 
                                backgroundColor: "#EF4444",
                                boxShadow: `0 4px 20px ${hexToRgba("#EF4444", 0.4)}`,
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
                              </svg>
                              <span>Stop recording</span>
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })()}
                  </div>
                )}

                <PromptBoard
                prompts={generatedPrompts}
                selectedPromptId={selectedPrompt?.id || null}
                intent={intent}
                scenario={scenario}
                onSelectPrompt={handleSelectPrompt}
                onPracticePrompt={handlePracticePrompt}
                onFreestylePractice={handleFreestylePractice}
                isRecording={isRecording}
                isPreparing={isPreparing}
              />
              
              {/* Recording status - shown when recording */}
              {isRecording && (
                <div className="mx-auto w-full max-w-[640px] flex flex-col items-center gap-2">
                  <span className="text-sm text-[color:rgba(11,11,12,0.6)]" aria-live="polite">Recording…</span>
                </div>
              )}
            </>
          )}
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

          {/* Progress tracking teaser for anonymous users */}
          <ProgressPreview onSignIn={handleSignIn} />
        </section>
      )}
    </main>
  );
}


