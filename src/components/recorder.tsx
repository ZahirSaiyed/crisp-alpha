"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Gauge from "./Gauge";
import { AnimatePresence, motion } from "framer-motion";

type EnergyAnalysis = {
  variability: number | null;
  frameHopSec: number;
  hotspots: Array<{ start: number; end: number; label?: string }>;
  rmsNorm?: number[];
  frameTimes?: number[];
  pitch?: {
    rangeHz: number | null;
    variance: number | null;
    monotonyIndex: number | null;
    validCount: number;
    eosSlopesHzPerSec: number[];
    eosAverageSlopeHzPerSec: number | null;
    eosSegments?: Array<{ start: number; end: number; slope: number }>;
  };
};

type Phase = "idle" | "recording" | "ready" | "playing";
const MAX_SECONDS = 90;

export type RecorderHandle = {
  start: () => void;
  stop: () => void;
};

const Recorder = React.forwardRef<RecorderHandle, { stickyMobileCTA?: boolean; appearance?: "onLight" | "onDark"; onPhaseChange?: (p: Phase) => void; onBlobUrlChange?: (url: string | null, blob?: Blob | null) => void; disableLegacyResults?: boolean; onTranscript?: (p: { transcript: string | null; words: Array<{ word: string; start?: number; end?: number }> | null; paragraphs?: Array<{ text: string; start?: number; end?: number }> | null; durationSec?: number | null; }) => void; onTranscribingChange?: (loading: boolean) => void; showUI?: boolean }>(function Recorder({ stickyMobileCTA = true, appearance = "onLight", onPhaseChange, onBlobUrlChange, disableLegacyResults = false, onTranscript, onTranscribingChange, showUI = true }, ref) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [dgWords, setDgWords] = useState<Array<{ word: string; start?: number; end?: number; confidence?: number }> | null>(null);
  const [dgParagraphs, setDgParagraphs] = useState<Array<{ text: string; start?: number; end?: number }> | null>(null);
  const [isAnalyzingEnergy, setIsAnalyzingEnergy] = useState<boolean>(false);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [energy, setEnergy] = useState<EnergyAnalysis | null>(null);
  const [isFixtureResponse, setIsFixtureResponse] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const onStopFiredRef = useRef<boolean>(false);
  const stopWatchdogRef = useRef<number | null>(null);
  const finalizedRef = useRef<boolean>(false);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    onBlobUrlChange?.(blobUrl, currentBlob);
  }, [blobUrl, currentBlob, onBlobUrlChange]);

  useEffect(() => {
    // Allow external trigger to begin/stop recording
    function onBegin() { startRecording(); }
    function onStop() { stopRecording(); }
    window.addEventListener("app:begin-recording", onBegin as EventListener);
    window.addEventListener("app:stop-recording", onStop as EventListener);
    return () => {
      window.removeEventListener("app:begin-recording", onBegin as EventListener);
      window.removeEventListener("app:stop-recording", onStop as EventListener);
    };
  }, []);

  // Pick a supported audio MIME in priority order (broadest first)
  function pickSupportedMime(): string | null {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/mpeg",
    ];
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported?.(t)) return t;
    }
    // Some browsers (older Safari) may support MediaRecorder but not these types; let it pick default
    return "";
  }

  // Cleanup object URLs when component unmounts or new blob created
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimers() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (stopWatchdogRef.current) {
      window.clearTimeout(stopWatchdogRef.current);
      stopWatchdogRef.current = null;
    }
  }

  function stopAll() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    clearTimers();
  }

  async function transcribeAudio(sourceBlob?: Blob) {
    if (!sourceBlob && !blobUrl) return;
    setIsTranscribing(true);
    try { onTranscribingChange?.(true); } catch {}
    setTranscriptionError(null);
    setTranscript(null);
    setDgWords(null);
    setDgParagraphs(null);
    setIsFixtureResponse(false);

    try {
      // Resolve audio blob either from provided source or from current blobUrl
      const audioBlob = sourceBlob ? sourceBlob : await (await fetch(blobUrl as string)).blob();

      // Direct upload to transcription API
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const apiResponse = await fetch("/api/transcribe", { 
        method: "POST", 
        body: formData 
      });
      const raw = await apiResponse.json();
      if (!apiResponse.ok) {
        const msg = (raw && typeof raw === "object") ? ((raw.message as string) || (raw.error as string)) : undefined;
        throw new Error(msg || "Transcription failed");
      }
      const data = (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>))
        ? (raw as { data: unknown }).data as Record<string, unknown>
        : (raw as Record<string, unknown>);

      
      // Track source to handle duration in fixture mode
      const isFixture = (data as Record<string, unknown>)?.source === "fixture";
      setIsFixtureResponse(isFixture);

      setTranscript((data as Record<string, unknown>).transcript as string);
      if (Array.isArray((data as Record<string, unknown>).words)) {
        setDgWords(
          (data as Record<string, unknown>).words.map((w: unknown) => {
            const obj = (w ?? {}) as Record<string, unknown>;
            const wordVal = typeof obj.word === "string" ? obj.word : String(obj.word ?? "");
            const startVal = typeof obj.start === "number" ? obj.start : undefined;
            const endVal = typeof obj.end === "number" ? obj.end : undefined;
            const confVal = typeof obj.confidence === "number" ? obj.confidence : undefined;
            return { word: wordVal, start: startVal, end: endVal, confidence: confVal };
          })
        );
      }

      if (Array.isArray((data as Record<string, unknown>).paragraphs)) {
        setDgParagraphs(
          (data as Record<string, unknown>).paragraphs.map((p: unknown) => {
            const obj = (p ?? {}) as Record<string, unknown>;
            const text = typeof obj.text === "string" ? obj.text : String(obj.text ?? "");
            const start = typeof obj.start === "number" ? obj.start : undefined;
            const end = typeof obj.end === "number" ? obj.end : undefined;
            return { text, start, end };
          })
        );
      }

      // In fixture mode, force duration from Deepgram timings to match the fixture
      if (isFixture && Array.isArray((data as Record<string, unknown>).words)) {
        let lastEnd = 0;
        for (const w of (data as Record<string, unknown>).words as Array<Record<string, unknown>>) {
          const end = typeof w.end === "number" ? w.end : undefined;
          if (typeof end === "number" && end > lastEnd) lastEnd = end;
        }
        if (lastEnd > 0) setAudioDurationSec(lastEnd);
      }

      // Notify parent with transcript, words, and paragraphs
      try {
        const wordsArr = Array.isArray((data as Record<string, unknown>).words)
          ? ((data as Record<string, unknown>).words.map((raw: unknown) => {
              const wObj = (raw ?? {}) as Record<string, unknown>;
              const word = typeof wObj.word === "string" ? wObj.word : String(wObj.word ?? "");
              const start = typeof wObj.start === "number" ? wObj.start : undefined;
              const end = typeof wObj.end === "number" ? wObj.end : undefined;
              return { word, start, end };
            }) as Array<{ word: string; start?: number; end?: number }>)
          : null;
        const parasArr = Array.isArray((data as Record<string, unknown>).paragraphs)
          ? ((data as Record<string, unknown>).paragraphs.map((raw: unknown) => {
              const pObj = (raw ?? {}) as Record<string, unknown>;
              const text = typeof pObj.text === "string" ? pObj.text : String(pObj.text ?? "");
              const start = typeof pObj.start === "number" ? pObj.start : undefined;
              const end = typeof pObj.end === "number" ? pObj.end : undefined;
              return { text, start, end };
            }) as Array<{ text: string; start?: number; end?: number }>)
          : null;
        onTranscript?.({ transcript: ((data as Record<string, unknown>).transcript as string) ?? null, words: wordsArr, paragraphs: parasArr, durationSec: audioDurationSec });
      } catch {}

      // Run energy analysis after transcription so we can align hotspots to content words
      try {
        setIsAnalyzingEnergy(true);
        setEnergyError(null);
        const metrics = await analyzeEnergyFromBlob(audioBlob, Array.isArray((data as Record<string, unknown>).words) ? (data as Record<string, unknown>).words as unknown[] : null);
        setEnergy(metrics);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Energy analysis failed";
        setEnergyError(msg);
        setEnergy(null);
      } finally {
        setIsAnalyzingEnergy(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transcription failed";
      setTranscriptionError(errorMessage);
    } finally {
      setIsTranscribing(false);
      try { onTranscribingChange?.(false); } catch {}
    }
  }

  async function analyzeEnergyFromBlob(
    audioBlob: Blob,
    rawWords: unknown[] | null
  ): Promise<EnergyAnalysis> {
    // 1) Decode audio, resample to 16k mono using OfflineAudioContext
    const pcmInfo = await decodeToPCM16kMono(audioBlob);
    const sr = pcmInfo.sampleRate;
    const pcm = pcmInfo.pcm;
    // High-pass filter ~70 Hz to reduce DC and very low frequency components for pitch
    const fc = 70;
    const dt = 1 / sr;
    const rc = 1 / (2 * Math.PI * fc);
    const alpha = rc / (rc + dt);
    const hp = new Float32Array(pcm.length);
    let yPrev = 0;
    let xPrev = 0;
    for (let i = 0; i < pcm.length; i++) {
      const x = pcm[i] || 0;
      const y = alpha * (yPrev + x - xPrev);
      hp[i] = y;
      yPrev = y;
      xPrev = x;
    }

    // 2) Frame: 25 ms window, 10 ms hop
    const winSec = 0.025;
    const hopSec = 0.010;
    const frameSize = Math.max(1, Math.round(winSec * sr));
    const hopSize = Math.max(1, Math.round(hopSec * sr));
    const numFrames = Math.max(0, 1 + Math.floor((pcm.length - frameSize) / hopSize));
    const rms: number[] = [];
    const frameTimes: number[] = [];
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopSize;
      const end = start + frameSize;
      let sumsq = 0;
      for (let j = start; j < end; j++) {
        const v = hp[j] || 0;
        sumsq += v * v;
      }
      const mean = sumsq / frameSize;
      rms.push(Math.sqrt(mean));
      frameTimes.push(start / sr);
    }

    if (rms.length === 0) {
      return { variability: null, frameHopSec: hopSec, hotspots: [] };
    }

    // 3) Normalize by 95th percentile
    const sorted = [...rms].sort((a, b) => a - b);
    const idx95 = Math.min(sorted.length - 1, Math.max(0, Math.floor(0.95 * (sorted.length - 1))));
    const p95 = sorted[idx95] || 1e-9;
    const rmsNorm = rms.map((v) => v / (p95 || 1e-9));

    // 4) Energy variability = stddev(RMS) / mean(RMS) using normalized RMS
    const meanR = rmsNorm.reduce((a, b) => a + b, 0) / rmsNorm.length;
    const varianceR = rmsNorm.reduce((a, b) => a + Math.pow(b - meanR, 2), 0) / rmsNorm.length;
    const stdR = Math.sqrt(varianceR);
    const variability = meanR > 0 ? Math.round((stdR / meanR) * 100) / 100 : null;

    // 5) Emphasis hotspots: RMS > 1.2 × moving average for ≥200 ms
    const MA_SEC = 1.0; // 1s moving average window
    const maWin = Math.max(1, Math.round(MA_SEC / hopSec));
    const prefix: number[] = [0];
    for (let i = 0; i < rmsNorm.length; i++) prefix.push((prefix[prefix.length - 1]!) + (rmsNorm[i] ?? 0));
    const movingAvg: number[] = [];
    for (let i = 0; i < rmsNorm.length; i++) {
      const start = Math.max(0, i - maWin + 1);
      const end = i + 1;
      const sum = (prefix[end]!) - (prefix[start]!);
      movingAvg.push(sum / (end - start));
    }
    const over: boolean[] = rmsNorm.map((v, i) => v > 1.2 * (movingAvg[i] || 1e-9));
    const minFrames = Math.ceil(0.200 / hopSec); // ≥200ms contiguous
    const hotspots: Array<{ start: number; end: number; label?: string }> = [];
    let runStart: number | null = null;
    for (let i = 0; i < over.length; i++) {
      if (over[i] && runStart === null) runStart = i;
      const atEnd = i === over.length - 1;
      if ((!over[i] || atEnd) && runStart !== null) {
        const runEndIdx = atEnd && over[i] ? i : i - 1;
        const len = runEndIdx - runStart + 1;
        if (len >= minFrames) {
          const startT = frameTimes[runStart]!;
          const endT = (frameTimes[runEndIdx]!) + hopSec; // approximate end of last frame
          hotspots.push({ start: startT, end: endT });
        }
        runStart = null;
      }
    }

    // Pitch extraction via autocorrelation on the same frames (stride to reduce cost)
    const f0Series: number[] = [];
    const f0Times: number[] = [];
    if (numFrames > 0) {
      const lagMin = Math.max(1, Math.floor(sr / 300)); // ~53 at 16kHz
      const lagMax = Math.min(frameSize - 1, Math.ceil(sr / 75)); // ~213 at 16kHz
      const threshold = 0.6;
      const stride = 2; // compute pitch every 20ms to reduce CPU
      for (let i = 0; i < numFrames; i += stride) {
        const start = i * hopSize;
        const end = start + frameSize;
        // Copy frame to temp array
        const frame = hp.subarray(start, end);
        // Energy at zero lag
        let r0 = 0;
        for (let k = 0; k < frame.length; k++) {
          const s = frame[k] || 0;
          r0 += s * s;
        }
        if (r0 <= 1e-9) continue;
        let bestLag = -1;
        let bestCorr = -1;
        for (let lag = lagMin; lag <= lagMax; lag++) {
          let sum = 0;
          for (let k = 0; k + lag < frame.length; k++) {
            sum += (frame[k] || 0) * (frame[k + lag] || 0);
          }
          const corr = sum / r0;
          if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
          }
        }
        if (bestLag > 0 && bestCorr >= threshold) {
          const f0 = sr / bestLag;
          if (f0 >= 75 && f0 <= 300) {
            f0Series.push(f0);
            f0Times.push(start / sr);
          }
        }
      }
    }

    // Pitch stats
    let pitchRangeHz: number | null = null;
    let pitchVariance: number | null = null;
    let monotonyIndex: number | null = null;
    if (f0Series.length > 1) {
      const sortedF = [...f0Series].sort((a, b) => a - b);
      const p5i = Math.max(0, Math.floor(0.05 * (sortedF.length - 1)));
      const p95i = Math.min(sortedF.length - 1, Math.floor(0.95 * (sortedF.length - 1)));
      pitchRangeHz = Math.round(((sortedF[p95i]!) - (sortedF[p5i]!)) * 10) / 10;
      const meanF = f0Series.reduce((a, b) => a + b, 0) / f0Series.length;
      const varF = f0Series.reduce((a, b) => a + Math.pow(b - meanF, 2), 0) / f0Series.length;
      pitchVariance = Math.round(varF * 100) / 100;
      monotonyIndex = Math.round((1 / (1 + varF)) * 1000) / 1000;
    }

    // End-of-sentence slope over last 400ms of each utterance using word timings
    const eosSlopes: number[] = [];
    const eosSegmentsOut: Array<{ start: number; end: number; slope: number }> = [];
    if (rawWords && Array.isArray(rawWords) && rawWords.length > 1 && f0Times.length > 1) {
      const words = (rawWords as unknown[]).map((w) => {
        const obj = (w ?? {}) as Record<string, unknown>;
        const startVal = typeof obj.start === "number" ? obj.start : undefined;
        const endVal = typeof obj.end === "number" ? obj.end : undefined;
        const wordVal = typeof obj.word === "string" ? obj.word : String(obj.word ?? "");
        return { start: startVal, end: endVal, word: wordVal };
      }).filter((w) => typeof w.start === "number" && typeof w.end === "number") as Array<{ start: number; end: number; word: string }>;
      words.sort((a, b) => (a.start as number) - (b.start as number));
      const segments: Array<{ start: number; end: number }> = [];
      if (Array.isArray(words) && words.length > 0) {
        const firstWord = words.at(0);
        if (firstWord) {
          let segStart = firstWord.start;
          for (let i = 1; i < words.length; i++) {
            const curr = words[i];
            const prev = words[i - 1];
            if (!curr || !prev) continue;
            const gap = curr.start - prev.end;
            if (gap >= 0.4) {
              segments.push({ start: segStart, end: prev.end });
              segStart = curr.start;
            }
          }
          const last = words[words.length - 1];
          if (last) segments.push({ start: segStart, end: last.end });
        }
      }

      const windowSec = 0.4;
      for (const seg of segments) {
        const t0 = Math.max(seg.start, seg.end - windowSec);
        const t1 = seg.end;
        // Collect f0 samples in [t0, t1]
        const idxs: number[] = [];
        for (let i = 0; i < f0Times.length; i++) {
          const t = f0Times[i] ?? -Infinity;
          if (t >= t0 && t <= t1) idxs.push(i);
        }
        if (idxs.length >= 2) {
          const firstIdx = idxs[0]!;
          const lastIdx = idxs[idxs.length - 1]!;
          const df = (f0Series[lastIdx]!) - (f0Series[firstIdx]!);
          const dt = (f0Times[lastIdx]!) - (f0Times[firstIdx]!);
          if (dt > 0) {
            const slope = Math.round((df / dt) * 100) / 100; // Hz/sec
            eosSlopes.push(slope);
            eosSegmentsOut.push({ start: seg.start, end: seg.end, slope });
          }
        }
      }
    }
    const eosAverage = eosSlopes.length > 0 ? Math.round((eosSlopes.reduce((a, b) => a + b, 0) / eosSlopes.length) * 100) / 100 : null;

    // Align hotspots to nearby content words if available
    if (rawWords && Array.isArray(rawWords) && rawWords.length > 0) {
      const words = (rawWords as unknown[]).map((w) => {
        const obj = (w ?? {}) as Record<string, unknown>;
        const wordVal = typeof obj.word === "string" ? obj.word : String(obj.word ?? "");
        const startVal = typeof obj.start === "number" ? obj.start : undefined;
        const endVal = typeof obj.end === "number" ? obj.end : undefined;
        return { word: wordVal, start: startVal, end: endVal };
      });
      const stop = new Set([
        "the","a","an","and","or","but","if","in","on","at","by","to","of","for","with","as","is","are","am","was","were","be","been","being","i","you","he","she","it","we","they","me","him","her","them","my","your","his","her","their","our","so","well","right","okay","um","uh","like","you","know","actually","basically","literally"
      ]);
      const contentWords = words.filter((w) => typeof w.start === "number" && typeof w.end === "number" && /[a-z]/i.test(w.word) && !stop.has(w.word.toLowerCase()));
      for (const h of hotspots) {
        const center = (h.start + h.end) / 2;
        let best: { word: string; mid: number } | null = null;
        for (const w of contentWords) {
          const mid = ((w.start as number) + (w.end as number)) / 2;
          const d = Math.abs(mid - center);
          if (!best || d < Math.abs(best.mid - center)) best = { word: w.word, mid };
        }
        if (best) h.label = best.word;
      }
    }

    return {
      variability,
      frameHopSec: hopSec,
      hotspots,
      rmsNorm,
      frameTimes,
      pitch: {
        rangeHz: pitchRangeHz,
        variance: pitchVariance,
        monotonyIndex,
        validCount: f0Series.length,
        eosSlopesHzPerSec: eosSlopes,
        eosAverageSlopeHzPerSec: eosAverage,
        eosSegments: eosSegmentsOut,
      },
    };
  }

  function energyBadge(variability: number | null): { label: string; color: string } {
    if (variability == null) return { label: "—", color: "#9CA3AF" };
    // Heuristic: >=0.3 feels lively, <0.15 is flat
    if (variability >= 0.3) return { label: "Alive", color: "#10B981" };
    if (variability < 0.15) return { label: "Flat", color: "#EF4444" };
    return { label: "Moderate", color: "#F59E0B" };
  }

  function expressivenessBadge(rangeHz: number | null): { label: string; color: string } {
    if (rangeHz == null) return { label: "—", color: "#9CA3AF" };
    if (rangeHz >= 80) return { label: "Expressive", color: "#10B981" };
    if (rangeHz >= 40) return { label: "Moderate", color: "#F59E0B" };
    return { label: "Flat", color: "#EF4444" };
  }

  function monotonyCompareText(mi: number | null): string {
    if (mi == null) return "—";
    const target = 0.35; // heuristic target for confident speakers
    if (mi > target) {
      const pct = Math.round(((mi - target) / target) * 100);
      return `Your voice varied ${pct}% less than confident speakers.`;
    } else if (mi < target) {
      const pct = Math.round(((target - mi) / target) * 100);
      return `Your voice varied ${pct}% more than confident speakers.`;
    }
    return "Matches confident speakers.";
  }

  function slopeLabel(s: number): { arrow: string; text: string } {
    if (s > 10) return { arrow: "↑", text: "rising — may sound unsure" };
    if (s < -10) return { arrow: "↓", text: "falling — reads as confident" };
    return { arrow: "→", text: "flat — neutral ending" };
  }

  function renderTranscriptRich(): React.ReactNode {
    if (!transcript) return null;
    if (!dgWords || dgWords.length === 0 || !energy?.hotspots) {
      return highlightFiller(transcript);
    }
    const hotspots = energy.hotspots;
    const tokens = dgWords;
    const isInHotspot = (t: number) => hotspots.some((h) => t >= h.start && t <= h.end);
    const nodes: React.ReactNode[] = [];
    const fillersSingle = new Set(["um", "uh", "like"]);
    let i = 0;
    let key = 0;
    while (i < tokens.length) {
      const w = tokens[i]!;
      const word = (w.word || "");
      const low = word.toLowerCase().replace(/^\W+|\W+$/g, "");
      const mid = typeof w.start === "number" && typeof w.end === "number" ? (w.start + w.end) / 2 : undefined;
      const emphasis = typeof mid === "number" ? isInHotspot(mid) : false;

      // detect phrase filler "you know"
      let isFiller = false;
      let consumeNext = false;
      if (low === "you" && tokens[i + 1]) {
        const nxt = ((tokens[i + 1]!.word) || "").toLowerCase().replace(/^\W+|\W+$/g, "");
        if (nxt === "know") {
          isFiller = true;
          consumeNext = true;
        }
      }
      if (!isFiller && fillersSingle.has(low)) isFiller = true;

      const wordText = word;
      let node: React.ReactNode = wordText;
      if (isFiller) {
        node = (
          <mark key={`mk-${key++}`} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {wordText}
          </mark>
        );
      }
      if (emphasis) {
        node = (
          <strong key={`st-${key++}`} className="font-semibold text-gray-900">
            {node}
          </strong>
        );
      }
      nodes.push(<React.Fragment key={`w-${i}`}>{node}{" "}</React.Fragment>);

      if (consumeNext) {
        // Render the second token of "you know" similarly (as filler, share emphasis by recomputing)
        const w2 = tokens[i + 1]!;
        const mid2 = typeof w2.start === "number" && typeof w2.end === "number" ? (w2.start + w2.end) / 2 : undefined;
        const emphasis2 = typeof mid2 === "number" ? isInHotspot(mid2) : false;
        let node2: React.ReactNode = w2.word;
        node2 = (
          <mark key={`mk-${key++}`} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {node2}
          </mark>
        );
        if (emphasis2) {
          node2 = (
            <strong key={`st-${key++}`} className="font-semibold text-gray-900">
              {node2}
            </strong>
          );
        }
        nodes.push(<React.Fragment key={`w-${i + 1}`}>{node2}{" "}</React.Fragment>);
        i += 2;
      } else {
        i += 1;
      }
    }
    return nodes;
  }

  async function decodeToPCM16kMono(blob: Blob): Promise<{ pcm: Float32Array; sampleRate: number }> {
    const arrayBuf = await blob.arrayBuffer();
    const ACctor: typeof AudioContext | undefined =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ACctor) {
      throw new Error("Web Audio API not supported in this browser");
    }
    const ctx = new ACctor();
    const decoded: AudioBuffer = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
    });
    await ctx.close();
    const targetSr = 16000;
    const length = Math.max(1, Math.ceil(decoded.duration * targetSr));
    const OfflineCtor = typeof OfflineAudioContext !== "undefined" ? OfflineAudioContext : null;
    if (!OfflineCtor) {
      throw new Error("OfflineAudioContext not supported in this browser");
    }
    const offline = new OfflineCtor(1, length, targetSr);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const mono = rendered.getChannelData(0);
    // Copy to a standalone Float32Array to avoid underlying buffer reuse
    return { pcm: new Float32Array(mono), sampleRate: targetSr };
  }

  function calculateWpm(): number | null {
    if (!transcript) return null;
    const numWords = transcript.trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds = audioDurationSec ?? (elapsed > 0 ? elapsed : 0);
    const minutes = durationSeconds / 60;
    if (!minutes) return null;
    return Math.round((numWords / minutes) * 10) / 10;
  }

  function highlightFiller(text: string): React.ReactNode[] {
    const fillers = [
      "you know",
      "i mean",
      "kind of",
      "sort of",
      "um",
      "uh",
      "like",
      "so",
      "actually",
      "basically",
      "literally",
      "okay",
      "right",
      "well",
      "hmm",
    ];
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = fillers
      .sort((a, b) => b.length - a.length)
      .map((p) => escapeRegExp(p).replace(/\s+/g, "\\s+"))
      .join("|");
    if (!pattern) return [text];

    const re = new RegExp(`(^|[^A-Za-z])(${pattern})($|[^A-Za-z])`, "gi");
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = re.exec(text)) !== null) {
      const [full, left, core, right] = match;
      const start = match.index;
      const end = start + full.length;
      if (lastIndex < start) nodes.push(text.slice(lastIndex, start));
      if (left) nodes.push(left);
      nodes.push(
        <mark key={`fill-${key++}`} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {core}
        </mark>
      );
      if (right) nodes.push(right);
      lastIndex = end;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
  }

  function getEffectiveDurationSec(): number | null {
    if (Number.isFinite(audioDurationSec ?? NaN) && (audioDurationSec ?? 0) > 0) return audioDurationSec as number;
    if (dgWords && dgWords.length > 0) {
      const lastWithEnd = [...dgWords].reverse().find((w) => typeof w.end === "number");
      if (lastWithEnd?.end && lastWithEnd.end > 0) return lastWithEnd.end;
    }
    return elapsed > 0 ? elapsed : null;
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "—";
    const s = Math.round(seconds);
    const mPart = Math.floor(s / 60);
    const sPart = s % 60;
    return `${mPart}:${sPart.toString().padStart(2, "0")}`;
  }

  const metrics = useMemo(() => {
    const durationSec = getEffectiveDurationSec();
    const minutes = durationSec ? durationSec / 60 : null;

    // Total words (prefer Deepgram tokens if available)
    let totalWords: number | null = null;
    if (dgWords && dgWords.length > 0) {
      totalWords = dgWords.filter((w) => /[A-Za-z]/.test(w.word || "")).length;
    } else if (transcript) {
      totalWords = transcript.trim().split(/\s+/).filter(Boolean).length;
    }

    // Filler frequency per minute using DG tokens if available
    const fillersSingle = new Set(["um", "uh", "like"]);
    let fillerCount = 0;
    if (dgWords && dgWords.length > 0) {
      const tokens = dgWords.map((w) => ((w.word ?? "") as string).toLowerCase().replace(/^\W+|\W+$/g, ""));
      for (let i = 0; i < tokens.length; i++) {
        const t: string = tokens[i] ?? "";
        if (t === "you" && tokens[i + 1] === "know") {
          fillerCount += 1;
          i += 1; // consume next
          continue;
        }
        if (fillersSingle.has(t)) fillerCount += 1;
      }
    } else if (transcript) {
      const tx = (transcript ?? "").toLowerCase();
      const youKnowMatches = tx.match(/\byou\s+know\b/g) || [];
      const singlesMatches = tx.match(/\b(um|uh|like)\b/g) || [];
      fillerCount = youKnowMatches.length + singlesMatches.length;
    }
    const fillerPerMin = minutes && minutes > 0 ? Math.round((fillerCount / minutes) * 10) / 10 : null;

    // Pause stats using DG timings
    let longPausePerMin: number | null = null;
    let longPausePercent: number | null = null;

    // New detailed pause/rhythm metrics
    let avgGapSec: number | null = null;
    let medianGapSec: number | null = null;
    let longPauseCount: number | null = null;
    let mediumPauseCount: number | null = null;
    let pauseRatioPercent: number | null = null;
    let tempoStdDevWps: number | null = null;
    let totalPauseTimeSec: number | null = null;
    let totalTalkTimeSec: number | null = null;
    let pauseHighlights: Array<{ start: number; end: number; duration: number }> = [];
    let ratesWps: number[] = [];
    let rateWindowSec: number | null = null;

    if (dgWords && dgWords.length > 1 && durationSec && durationSec > 0) {
      const wordsWithTimes = dgWords.filter((w) => typeof w.start === "number" && typeof w.end === "number");
      wordsWithTimes.sort((a, b) => (a.start as number) - (b.start as number));

      const THRESH_LONG = 1.5;
      const THRESH_MED_MIN = 0.6;

      const gaps: number[] = [];
      const gapSpans: Array<{ start: number; end: number; gap: number }> = [];
      for (let i = 1; i < wordsWithTimes.length; i++) {
        const prev = wordsWithTimes[i - 1]!;
        const curr = wordsWithTimes[i]!;
        const gap = (curr.start as number) - (prev.end as number);
        if (gap > 0) {
          gaps.push(gap);
          gapSpans.push({ start: (prev.end as number), end: (curr.start as number), gap });
        }
      }

      if (gaps.length > 0) {
        const sum = gaps.reduce((a, b) => a + b, 0);
        avgGapSec = Math.round((sum / gaps.length) * 100) / 100;
        const sorted = [...gaps].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length - 1) / 2;
        if (sorted.length % 2 === 1) {
          medianGapSec = Math.round((sorted[Math.floor(mid)]!) * 100) / 100;
        } else {
          const m1 = sorted[sorted.length / 2 - 1]!;
          const m2 = sorted[sorted.length / 2]!;
          medianGapSec = Math.round(((m1 + m2) / 2) * 100) / 100;
        }

        const longGaps = gaps.filter((g) => g >= THRESH_LONG);
        const mediumGaps = gaps.filter((g) => g >= THRESH_MED_MIN && g < THRESH_LONG);
        longPauseCount = longGaps.length;
        mediumPauseCount = mediumGaps.length;

        const totalPauseTime = sum; // sum of positive gaps
        const longPauseTotalTime = longGaps.reduce((a, b) => a + b, 0);
        pauseRatioPercent = Math.round(((totalPauseTime / durationSec) * 100) * 10) / 10;
        longPausePercent = Math.round(((longPauseTotalTime / durationSec) * 100) * 10) / 10;
        totalPauseTimeSec = Math.round(totalPauseTime * 100) / 100;
        totalTalkTimeSec = Math.max(0, Math.round((durationSec - totalPauseTime) * 100) / 100);
        pauseHighlights = gapSpans
          .filter((g) => g.gap >= THRESH_LONG)
          .sort((a, b) => b.gap - a.gap)
          .map((g) => ({ start: g.start, end: g.end, duration: Math.round(g.gap * 10) / 10 }));
      } else {
        longPauseCount = 0;
        mediumPauseCount = 0;
        pauseRatioPercent = 0;
        avgGapSec = 0;
        medianGapSec = 0;
        totalPauseTimeSec = 0;
        totalTalkTimeSec = durationSec;
      }

      // Keep previous long pause per minute for compatibility
      const longCountForPerMin = longPauseCount ?? 0;
      longPausePerMin = minutes && minutes > 0 ? Math.round((longCountForPerMin / minutes) * 10) / 10 : null;

      // Tempo stability: stddev of words/sec in 5s windows
      const WINDOW = 5;
      const rates: number[] = [];
      for (let start = 0; start < durationSec; start += WINDOW) {
        const end = Math.min(start + WINDOW, durationSec);
        const span = end - start;
        if (span <= 0) continue;
        const count = wordsWithTimes.filter((w) => (w.start as number) >= start && (w.start as number) < end).length;
        const wps = count / span;
        rates.push(wps);
      }
      ratesWps = rates;
      rateWindowSec = WINDOW;
      if (rates.length > 0) {
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const variance = rates.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rates.length;
        tempoStdDevWps = Math.round(Math.sqrt(variance) * 100) / 100;
      } else {
        tempoStdDevWps = 0;
      }
    }

    return {
      totalWords,
      durationSec,
      fillerPerMin,
      longPausePerMin,
      longPausePercent,
      avgGapSec,
      medianGapSec,
      longPauseCount,
      mediumPauseCount,
      pauseRatioPercent,
      tempoStdDevWps,
      totalPauseTimeSec,
      totalTalkTimeSec,
      pauseHighlights,
      ratesWps,
      rateWindowSec,
    };
  }, [dgWords, transcript, audioDurationSec, elapsed]);

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  function wpmLabel(wpm: number | null): string {
    if (!wpm) return "—";
    if (wpm < 110) return "A bit slow";
    if (wpm <= 170) return "Clear, confident pace";
    return "Too fast";
  }

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180; // rotate so 0° is at top
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const delta = Math.abs(endAngle - startAngle);
    const largeArcFlag = delta <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`; // sweep=1 (clockwise)
  }

  async function startRecording() {
    setError(null);
    setElapsed(0);
    setTranscript(null);
    setTranscriptionError(null);
    setAudioDurationSec(null);
    setDgWords(null);
    setDgParagraphs(null);

    // Feature detection
    if (typeof MediaRecorder === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setError(
        "This browser doesn't support in-page recording. Use the fallback upload below."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const chosen = pickSupportedMime();
      setMimeType(chosen);
      const mr = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
      mediaRecorderRef.current = mr;

      chunksRef.current = [];
      finalizedRef.current = false;
      const type = chosen || "audio/webm";
      const finalize = (finalBlob: Blob) => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        const url = URL.createObjectURL(finalBlob);
        setBlobUrl(url);
        setCurrentBlob(finalBlob);
        setPhase("ready");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        clearTimers();
        setTimeout(() => transcribeAudio(finalBlob), 0);
      };
      const tryFinalizeFromChunks = () => {
        if (finalizedRef.current) return;
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) {
          setTimeout(() => {
            if (finalizedRef.current) return;
            const retryBlob = new Blob(chunksRef.current, { type });
            if (retryBlob.size === 0) {
              setTranscriptionError("No audio captured. Please try recording for a few seconds.");
              setPhase("idle");
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              clearTimers();
              return;
            }
            finalize(retryBlob);
          }, 150);
          return;
        }
        finalize(blob);
      };
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        if (mediaRecorderRef.current?.state === "inactive") {
          tryFinalizeFromChunks();
        }
      };
      mr.onerror = () => {
        setTranscriptionError("Recording error. Please try again.");
      };
      mr.onstop = () => {
        onStopFiredRef.current = true;
        if (stopWatchdogRef.current) {
          window.clearTimeout(stopWatchdogRef.current);
          stopWatchdogRef.current = null;
        }
        // Final safety: if final dataavailable didn't trigger finalize, do it here
        tryFinalizeFromChunks();
      };

      mr.start(); // let the browser buffer; final blob will arrive on stop

      // Timer: hard-stop at MAX_SECONDS to cap size, avoid abuse
      timerRef.current = window.setTimeout(() => stopRecording(), MAX_SECONDS * 1000);
      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);

      setPhase("recording");
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === "NotAllowedError") {
        setError("Microphone permission denied.");
      } else if (location.protocol !== "https:") {
        setError("Recording requires HTTPS. Deploy to Vercel or use localhost over HTTPS.");
      } else {
        setError("Unable to access microphone.");
      }
      stopAll();
    }
  }

  function stopRecording() {
    try {
      const mr = mediaRecorderRef.current;
      if (!mr) return;
      mr.stop();
      // Watchdog: if onstop doesn't fire, finalize after 1.5s using whatever chunks we have
      if (stopWatchdogRef.current) {
        window.clearTimeout(stopWatchdogRef.current);
        stopWatchdogRef.current = null;
      }
      stopWatchdogRef.current = window.setTimeout(() => {
        if (onStopFiredRef.current) return;
        // Fallback finalize
        const t = (mimeType || "audio/webm");
        const blob = new Blob(chunksRef.current, { type: t });
        if (blob.size > 0) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setCurrentBlob(blob);
          setPhase("ready");
          streamRef.current?.getTracks().forEach((trk) => trk.stop());
          streamRef.current = null;
          clearTimers();
          setTimeout(() => transcribeAudio(blob), 0);
        } else {
          setTranscriptionError("No audio captured. Please try again.");
          setPhase("idle");
          streamRef.current?.getTracks().forEach((trk) => trk.stop());
          streamRef.current = null;
          clearTimers();
        }
      }, 1500);
    } catch {}
  }

  React.useImperativeHandle(ref, () => ({
    start: () => { startRecording(); },
    stop: () => { stopRecording(); },
  }));

  function onLoadedMetadata() {
    const audio = audioElRef.current;
    if (!audio) return;

    // Some browsers report Infinity duration for freshly recorded blobs (e.g., WebM)
    if (audio.duration === Infinity) {
      const handleTimeUpdate = () => {
        if (Number.isFinite(audio.duration) && !Number.isNaN(audio.duration) && audio.duration > 0) {
          setAudioDurationSec(audio.duration);
          audio.removeEventListener("timeupdate", handleTimeUpdate);
          // Reset back to start for normal playback UX
          audio.currentTime = 0;
        }
      };
      audio.addEventListener("timeupdate", handleTimeUpdate);
      // Seek far to coerce the browser to compute the real duration
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    } else if (Number.isFinite(audio.duration) && !Number.isNaN(audio.duration) && audio.duration > 0) {
      setAudioDurationSec(audio.duration);
    }
  }

  function play() {
    if (!blobUrl || !audioElRef.current) return;
    setPhase("playing");
    audioElRef.current.currentTime = 0;
    audioElRef.current.play().catch(() => {
      setPhase("ready");
    });
  }

  function onEnded() {
    setPhase("ready");
  }

  // Fallback: input capture for devices that lack MediaRecorder support
  function onFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    setCurrentBlob(file);
    setMimeType(file.type || null);
    setPhase("ready");
    setTranscript(null);
    setTranscriptionError(null);
    setAudioDurationSec(null);
    setDgWords(null);
    setDgParagraphs(null);
  }

  const canRecord =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    navigator?.mediaDevices?.getUserMedia;

  const disabled = phase === "recording";
  const secondsLeft = Math.max(0, MAX_SECONDS - elapsed);
  const isDark = appearance === "onDark";

  const primaryBtnClass = phase === "recording"
    ? "bg-red-600 text-white shadow-[0_10px_22px_rgba(239,68,68,0.28),_0_2px_6px_rgba(239,68,68,0.18)] hover:bg-red-500"
    : "";

  const labelClass = isDark ? "text-gray-400" : "text-gray-600";
  const statusText = phase === "recording"
    ? (() => {
        const m = Math.floor(elapsed / 60);
        const s = (elapsed % 60).toString().padStart(2, "0");
        return `Recording… ${m}:${s}`;
      })()
    : "Tap to start recording";
  
  function resetSession() {
    // Reset to idle and clear artifacts
    setPhase("idle");
    setTranscript(null);
    setDgWords(null);
    setDgParagraphs(null);
    setBlobUrl(null);
    setCurrentBlob(null);
    setAudioDurationSec(null);
    setEnergy(null);
    setTranscriptionError(null);
    setEnergyError(null);
    setElapsed(0);
  }

  function saveSession() {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        transcript,
        metrics,
        energy,
        audioDurationSec,
      };
      const key = `crisp-session-${payload.savedAt}`;
      localStorage.setItem(key, JSON.stringify(payload));
      alert("Session saved locally.");
    } catch {
      alert("Failed to save session.");
    }
  }

  // Custom playback state
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  function togglePlayPause() {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  function onTimeUpdate() {
    const el = audioElRef.current;
    if (!el) return;
    setPlaybackTime(el.currentTime || 0);
  }

  function onPlayEvent() {
    setIsPlaying(true);
    setPhase("playing");
  }

  function onPauseEvent() {
    setIsPlaying(false);
    if (phase === "playing") setPhase("ready");
  }

  function seekToFraction(frac: number) {
    const el = audioElRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.max(0, Math.min(el.duration * frac, el.duration));
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = rect.width > 0 ? x / rect.width : 0;
    seekToFraction(frac);
  }
 
  const ControlBar = (
    <div className="flex flex-col items-center gap-2">
      {/* Idle: red circle; Recording: red button with Stop text */}
      {phase !== "recording" ? (
        <button
          type="button"
          aria-label="Start recording"
          onClick={startRecording}
          className="rec-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
        >
          <style jsx>{`
            .rec-btn {
              position: relative;
              width: 56px; /* 14 * 4 */
              height: 56px;
              border-radius: 9999px;
              background: #ef4444; /* red-600 */
              transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms, background-color 180ms;
            }
            .rec-btn:hover { 
              transform: scale(1.06);
              box-shadow: 0 10px 22px rgba(239, 68, 68, 0.28), 0 2px 6px rgba(239, 68, 68, 0.18);
              background: #f05252; /* red-500 */
            }
            .rec-btn::after {
              content: "";
              position: absolute;
              inset: -6px;
              border-radius: inherit;
              border: 2px solid rgba(239, 68, 68, 0.45);
              opacity: 0;
              transform: scale(0.9);
              transition: opacity 200ms, transform 200ms;
            }
            .rec-btn:hover::after { opacity: 1; transform: scale(1); }
          `}</style>
          <style jsx>{`
            @keyframes pulse-ring { from { transform: scale(1); opacity: 0.45; } to { transform: scale(1.5); opacity: 0; } }
          `}</style>
          {/* Mic icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none">
            <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" fill="white"/>
            <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8v3H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" fill="white"/>
          </svg>
          <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 0 rgba(239,68,68,0.5)", animation: "pulse-ring 1.6s ease-out infinite" }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          aria-pressed
          className={`px-6 sm:px-8 py-3 sm:py-3.5 rounded-full text-base sm:text-lg font-semibold ${primaryBtnClass}`}
        >
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="white"/></svg>
            Stop
          </span>
        </button>
      )}
      {statusText && (
        <span className={`text-xs sm:text-sm ${labelClass}`} aria-live="polite">{statusText}</span>
      )}
      {isTranscribing && (
        <span className={`text-xs sm:text-sm ${labelClass}`}>Transcribing…</span>
      )}
    </div>
  );
 
  return (
    <div className={`space-y-4 ${transcript ? "mt-8 sm:mt-12" : ""}`}>
      {showUI && (
        <>
          {/* Inline controls: render ONCE. If stickyMobileCTA, only show on sm+ here. */}
          {!transcript && (
            stickyMobileCTA ? (
              <div className="hidden sm:flex justify-center">{ControlBar}</div>
            ) : (
              <div className="flex justify-center">{ControlBar}</div>
            )
          )}

          <AnimatePresence>
            {stickyMobileCTA && !transcript && (
              <motion.div
                key="sticky"
                className={`sm:hidden fixed inset-x-0 bottom-0 z-50 border-t ${isDark ? "border-gray-800 bg-black/80" : "border-gray-200 bg-white/80"} backdrop-blur py-3 px-4`}
                initial={{ y: 64, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 64, opacity: 0 }}
              >
                <div className="flex items-center justify-center max-w-3xl mx-auto">
                  {ControlBar}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
 
          {isClient && !canRecord && (
            <div className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Your browser doesn&apos;t support in-page recording.
              <div className="mt-2">
                <input
                  type="file"
                  accept="audio/*"
                  capture="user"
                  onChange={onFallbackFile}
                />
              </div>
            </div>
          )}
 
          {error && <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>{error}</p>}
          {transcriptionError && <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>{transcriptionError}</p>}
        </>
      )}

      {blobUrl && (
        <audio
          ref={audioElRef}
          src={blobUrl}
          onEnded={onEnded}
          onLoadedMetadata={(e) => { onLoadedMetadata(); setPlaybackTime(0); }}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlayEvent}
          onPause={onPauseEvent}
          className="hidden"
        />
      )}

      {showUI && !disableLegacyResults && transcript && (
        <>
          {/* Bold coach banner (not a tile) */}
          <div className="mx-auto max-w-4xl px-2">
            <div className="rounded-[20px] px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-[var(--bright-purple)]/12 via-[var(--bright-sky)]/12 to-[var(--bright-lime)]/12 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <div className="text-xl">🟢</div>
                <p className="text-base sm:text-lg font-semibold text-[color:var(--ink)]">You sounded confident and engaging — a strong foundation to build on.</p>
              </div>
            </div>
          </div>

          {/* Tiled details below */}
          <div className={`mt-8 sm:mt-10 grid gap-4 ${isDark ? "" : "[&>div]:bg-white/70 [&>div]:border [&>div]:border-[color:var(--muted-2)]"} grid-cols-1`}>
            {/* Tile: Transcript + Playback */}
            <div className="p-4 rounded-lg">
              <h3 className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-[color:var(--ink)]"}`}>Playback & Transcript</h3>
              <div className="space-y-4">
                {blobUrl && (
                  <div className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-[2px] border border-[color:var(--muted-2)] p-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "var(--bright-purple)", color: "white" }}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="white"/></svg>
                      )}
                    </button>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="w-full h-2.5 rounded-full bg-[color:var(--muted-2)] cursor-pointer" onClick={handleProgressClick}>
                        <div
                          className="h-2.5 rounded-full"
                          style={{ width: `${(() => {
                            const dur = audioElRef.current?.duration || audioDurationSec || 0;
                            const t = playbackTime || 0;
                            if (!dur || dur <= 0) return 0;
                            return Math.min(100, Math.max(0, (t / dur) * 100));
                          })()}%`, background: "var(--bright-purple)" }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[color:rgba(11,11,12,0.6)]">
                        <span>{formatDuration(playbackTime)}</span>
                        <span>{formatDuration(audioElRef.current?.duration || audioDurationSec || 0)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className={`text-sm leading-7 ${isDark ? "text-gray-100" : "text-[color:var(--ink)]"} max-h-64 overflow-auto pr-1`}>{renderTranscriptRich()}</div>
              </div>
            </div>

            {/* Tile: Pace (WPM) */}
            <div className="p-4 rounded-lg">
              <h3 className="text-base font-semibold mb-2">Pace</h3>
              <div className="flex items-center justify-between">
                {(() => {
                  const wpm = calculateWpm();
                  const minW = 80, maxW = 220;
                  const value = typeof wpm === "number" ? Math.max(minW, Math.min(wpm, maxW)) - minW : 0;
                  return <Gauge value={value} max={maxW - minW} label={`${wpm ?? "—"} WPM`} color="#12B886" trackColor="#E5E7EB" />;
                })()}
                <div className="text-sm max-w-[12rem]">
                  {(() => {
                    const wpm = calculateWpm();
                    if (!wpm) return "We’ll estimate your pace in words per minute.";
                    if (wpm < 110) return "Steady, measured delivery. Try adding energy before key points.";
                    if (wpm <= 170) return "✅ Clear, confident pace — easy to follow.";
                    return "Fast — add a brief pause before big ideas so they land.";
                  })()}
                  <div className="text-xs mt-1 text-[color:rgba(11,11,12,0.6)]">👉 Slow slightly before key points to add punch.</div>
                </div>
              </div>
            </div>

            {/* Tile: Energy */}
            <div className="p-4 rounded-lg">
              <h3 className="text-base font-semibold mb-2">Energy</h3>
              {(() => {
                const rn = energy?.rmsNorm || [];
                const w = 320, h = 60, pad = 4;
                if (rn.length === 0) return <div className="text-xs text-[color:rgba(11,11,12,0.6)]">Not enough data</div>;
                const maxV = Math.max(1, Math.max(...rn));
                const points = rn.map((v, i) => {
                  const x = pad + (i / Math.max(1, rn.length - 1)) * (w - 2 * pad);
                  const y = h - pad - (clamp(v, 0, maxV) / maxV) * (h - 2 * pad);
                  return `${x},${y}`;
                }).join(" ");
                return (
                  <>
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md h-[60px]">
                      <polyline points={points} fill="none" stroke="var(--bright-purple)" strokeWidth="2" />
                    </svg>
                    <div className="text-sm mt-2">
                      {(() => {
                        const v = energy?.variability ?? null;
                        if (v == null) return "We analyze changes in loudness to spot emphasis.";
                        if (v >= 0.3) return "Alive — strong emphasis kept attention.";
                        if (v < 0.15) return "Flat — add emphasis on key points.";
                        return "Moderate — vary tone to punch important ideas.";
                      })()}
                      <div className="text-xs mt-1 text-[color:rgba(11,11,12,0.6)]">👉 Great emphasis! Keep stressing key words to hold the room.</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Tile: Pauses */}
            <div className="p-4 rounded-lg">
              <h3 className="text-base font-semibold mb-2">Pauses</h3>
              <div className="text-sm">{(() => {
                 const perMin = metrics.longPausePerMin ?? null;
                 const ratio = metrics.pauseRatioPercent ?? null;
                 if (perMin == null || ratio == null) return "We track long pauses and overall silence ratio.";
                 const ratioText = `Long pauses: ${perMin}/min • Silence ${ratio}%`;
                 const overTarget = ratio > 22; // soft guard around ~20%
                 const underTarget = ratio < 15;
                 return (
                   <span className={overTarget ? "text-[#8A6D00]" : underTarget ? "text-[#8A6D00]" : ""}>
                     {ratioText}
                   </span>
                 );
               })()}</div>
              <div className="text-xs text-[color:rgba(11,11,12,0.6)] mt-1">⚖️ Solid balance. Use silence more strategically — pause after big points.</div>
            </div>

            {/* Tile: Expressiveness (Pitch) */}
            <div className="p-4 rounded-lg">
              <h3 className="text-base font-semibold mb-2">Expressiveness</h3>
              <div className="flex items-center justify-between">
                {(() => {
                  const range = energy?.pitch?.rangeHz ?? null;
                  const minR = 10, maxR = 150;
                  const value = typeof range === "number" ? Math.max(minR, Math.min(range, maxR)) - minR : 0;
                  return <Gauge value={value} max={maxR - minR} label={`${range ?? "—"} Hz`} color="#FF6B5E" trackColor="#E5E7EB" />;
                })()}
                <div className="text-sm max-w-[12rem]">
                  {(() => {
                    const range = energy?.pitch?.rangeHz ?? null;
                    if (range == null) return "Pitch range hints at vocal variety.";
                    if (range >= 80) return "Expressive — engaging tone.";
                    if (range >= 40) return "Moderate — add a bit more range.";
                    return "Flat — vary pitch to avoid monotone.";
                  })()}
                  <div className="text-xs mt-1 text-[color:rgba(11,11,12,0.6)]">👉 Try a rising tone at questions to invite curiosity.</div>
                </div>
              </div>
            </div>

            {/* Bottom CTAs spanning full width */}
            <div className="p-4 rounded-lg flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
              <button type="button" onClick={resetSession} className="px-4 py-2 rounded-full border border-[color:var(--muted-2)] bg-white/80 text-[color:var(--ink)]">
                🔁 Try again
              </button>
              <button type="button" onClick={saveSession} className="px-4 py-2 rounded-full cta-ylw font-semibold">
                💾 Save session
              </button>
            </div>
          </div>
        </>
      )}

      {showUI && (
        <p className={`mt-6 text-xs text-center ${isDark ? "text-gray-400" : "text-[color:rgba(11,11,12,0.6)]"}`}>Runs in your browser. Securely processed when you get results.</p>
      )}
    </div>
  );
});

export default Recorder;