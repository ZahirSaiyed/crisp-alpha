"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@deepgram/sdk";
import Gauge from "./Gauge";

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

export default function Recorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [dgWords, setDgWords] = useState<Array<{ word: string; start?: number; end?: number; confidence?: number }> | null>(null);
  const [isAnalyzingEnergy, setIsAnalyzingEnergy] = useState<boolean>(false);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [energy, setEnergy] = useState<EnergyAnalysis | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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

  async function transcribeAudio() {
    if (!blobUrl) return;
    
    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscript(null);
    setDgWords(null);

    try {
      // Convert blob URL to file
      const response = await fetch(blobUrl);
      const audioBlob = await response.blob();
      
      // Create FormData to send to API route
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      
      // Call our API route
      const apiResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      const data = await apiResponse.json();
      
      if (!apiResponse.ok) {
        throw new Error(data.error || "Transcription failed");
      }
      
      setTranscript(data.transcript);
      if (Array.isArray(data.words)) {
        setDgWords(
          data.words.map((w: unknown) => {
            const obj = (w ?? {}) as Record<string, unknown>;
            const wordVal = typeof obj.word === "string" ? obj.word : String(obj.word ?? "");
            const startVal = typeof obj.start === "number" ? obj.start : undefined;
            const endVal = typeof obj.end === "number" ? obj.end : undefined;
            const confVal = typeof obj.confidence === "number" ? obj.confidence : undefined;
            return { word: wordVal, start: startVal, end: endVal, confidence: confVal };
          })
        );
      }

      // Run energy analysis after transcription so we can align hotspots to content words
      try {
        setIsAnalyzingEnergy(true);
        setEnergyError(null);
        const metrics = await analyzeEnergyFromBlob(audioBlob, Array.isArray(data.words) ? data.words : null);
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
    for (let i = 0; i < rmsNorm.length; i++) prefix.push(prefix[prefix.length - 1] + rmsNorm[i]);
    const movingAvg: number[] = [];
    for (let i = 0; i < rmsNorm.length; i++) {
      const start = Math.max(0, i - maWin + 1);
      const end = i + 1;
      const sum = prefix[end] - prefix[start];
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
          const startT = frameTimes[runStart];
          const endT = frameTimes[runEndIdx] + hopSec; // approximate end of last frame
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
      pitchRangeHz = Math.round((sortedF[p95i] - sortedF[p5i]) * 10) / 10;
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
      words.sort((a, b) => a.start - b.start);
      const segments: Array<{ start: number; end: number }> = [];
      let segStart = words[0].start;
      for (let i = 1; i < words.length; i++) {
        const gap = words[i].start - words[i - 1].end;
        if (gap >= 0.4) {
          segments.push({ start: segStart, end: words[i - 1].end });
          segStart = words[i].start;
        }
      }
      segments.push({ start: segStart, end: words[words.length - 1].end });

      const windowSec = 0.4;
      for (const seg of segments) {
        const t0 = Math.max(seg.start, seg.end - windowSec);
        const t1 = seg.end;
        // Collect f0 samples in [t0, t1]
        const idxs: number[] = [];
        for (let i = 0; i < f0Times.length; i++) {
          const t = f0Times[i];
          if (t >= t0 && t <= t1) idxs.push(i);
        }
        if (idxs.length >= 2) {
          const firstIdx = idxs[0];
          const lastIdx = idxs[idxs.length - 1];
          const df = f0Series[lastIdx] - f0Series[firstIdx];
          const dt = f0Times[lastIdx] - f0Times[firstIdx];
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
      const w = tokens[i];
      const word = (w.word || "");
      const low = word.toLowerCase().replace(/^\W+|\W+$/g, "");
      const mid = typeof w.start === "number" && typeof w.end === "number" ? (w.start + w.end) / 2 : undefined;
      const emphasis = typeof mid === "number" ? isInHotspot(mid) : false;

      // detect phrase filler "you know"
      let isFiller = false;
      let consumeNext = false;
      if (low === "you" && tokens[i + 1]) {
        const nxt = (tokens[i + 1].word || "").toLowerCase().replace(/^\W+|\W+$/g, "");
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
        const w2 = tokens[i + 1];
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
      const tokens = dgWords.map((w) => (w.word || "").toLowerCase().replace(/^\W+|\W+$/g, ""));
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === "you" && tokens[i + 1] === "know") {
          fillerCount += 1;
          i += 1; // consume next
          continue;
        }
        if (fillersSingle.has(t)) fillerCount += 1;
      }
    } else if (transcript) {
      const tx = transcript.toLowerCase();
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
        const prev = wordsWithTimes[i - 1];
        const curr = wordsWithTimes[i];
        const gap = (curr.start as number) - (prev.end as number);
        if (gap > 0) {
          gaps.push(gap);
          gapSpans.push({ start: prev.end as number, end: curr.start as number, gap });
        }
      }

      if (gaps.length > 0) {
        const sum = gaps.reduce((a, b) => a + b, 0);
        avgGapSec = Math.round((sum / gaps.length) * 100) / 100;
        const sorted = [...gaps].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length - 1) / 2;
        if (sorted.length % 2 === 1) {
          medianGapSec = Math.round(sorted[Math.floor(mid)] * 100) / 100;
        } else {
          const m1 = sorted[sorted.length / 2 - 1];
          const m2 = sorted[sorted.length / 2];
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
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = chosen || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPhase("ready");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        clearTimers();
      };

      mr.start(100); // collect data in small chunks

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
      mediaRecorderRef.current?.stop();
    } catch {}
  }

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
    setMimeType(file.type || null);
    setPhase("ready");
    setTranscript(null);
    setTranscriptionError(null);
    setAudioDurationSec(null);
    setDgWords(null);
  }

  const canRecord =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    navigator?.mediaDevices?.getUserMedia;

  const disabled = phase === "recording";
  const secondsLeft = Math.max(0, MAX_SECONDS - elapsed);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={phase === "recording" ? stopRecording : startRecording}
          aria-pressed={phase === "recording"}
          className={`px-4 py-2 rounded ${
            phase === "recording" ? "bg-red-600 text-white" : "bg-black text-white"
          }`}
        >
          {phase === "recording" ? "Stop" : "Record"}
        </button>
        <span className="text-sm text-gray-600">
          {phase === "recording"
            ? `Recording… ${secondsLeft}s left`
            : mimeType
            ? `Format: ${mimeType}`
            : "Ready"}
        </span>
      </div>

      {isClient && !canRecord && (
        <div className="text-sm text-gray-700">
          Your browser doesn&apos;t support in-page recording. Use the fallback:
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {blobUrl && (
        <div className="space-y-2">
          <audio
            ref={audioElRef}
            src={blobUrl}
            controls
            onEnded={onEnded}
            onLoadedMetadata={onLoadedMetadata}
            className="w-full"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={play}
              className="px-3 py-1.5 rounded border border-gray-300"
              disabled={phase === "playing"}
            >
              Play
            </button>
            <button
              type="button"
              onClick={transcribeAudio}
              className="px-3 py-1.5 rounded bg-blue-600 text-white"
              disabled={isTranscribing}
            >
              {isTranscribing ? "Transcribing..." : "Get Transcript"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                setBlobUrl(null);
                setElapsed(0);
                setPhase("idle");
                setError(null);
                setTranscript(null);
                setTranscriptionError(null);
                setAudioDurationSec(null);
                setDgWords(null);
              }}
              className="px-3 py-1.5 rounded border border-gray-300"
            >
              Record again
            </button>
          </div>
        </div>
      )}

      {transcript && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Transcript:</h3>
          <p className="text-sm text-gray-900 leading-7">{renderTranscriptRich()}</p>
          <div className="mt-3 text-xs text-gray-600">
            Words per minute (WPM):
            <span className="ml-1 font-semibold text-gray-900">{calculateWpm() ?? "—"}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
            <div>
              <span className="text-gray-600">Total words:</span>
              <span className="ml-1 font-medium text-gray-900">{metrics.totalWords ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <span className="ml-1 font-medium text-gray-900">{formatDuration(metrics.durationSec)}</span>
            </div>
            <div>
              <span className="text-gray-600">Filler freq (/min):</span>
              <span className="ml-1 font-medium text-gray-900">{metrics.fillerPerMin ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-600">Long pauses &gt;1.5s:</span>
              <span className="ml-1 font-medium text-gray-900">
                {metrics.longPausePerMin ?? "—"}/min
                {typeof metrics.longPausePercent === "number" ? ` • ${metrics.longPausePercent}%` : ""}
              </span>
            </div>
          </div>
          {/* Energy coaching UI */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Energy (coaching)</h4>
            <div className="flex items-center gap-3">
              {(() => {
                const rn = energy?.rmsNorm || [];
                const w = 260, h = 60, pad = 4;
                if (rn.length === 0) return <div className="text-xs text-gray-500">No energy trace</div>;
                const maxV = Math.max(1, Math.max(...rn));
                const points = rn.map((v, i) => {
                  const x = pad + (i / Math.max(1, rn.length - 1)) * (w - 2 * pad);
                  const y = h - pad - (clamp(v, 0, maxV) / maxV) * (h - 2 * pad);
                  return `${x},${y}`;
                }).join(" ");
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-[260px] h-[60px]">
                    <polyline points={points} fill="none" stroke="#F59E0B" strokeWidth="2" />
                  </svg>
                );
              })()}
              {(() => {
                const b = energyBadge(energy?.variability ?? null);
                return (
                  <div className="text-xs">
                    <span className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: b.color }}>{b.label}</span>
                    <div className="text-gray-500 mt-1 italic">Good energy shifts keep people listening.</div>
                  </div>
                );
              })()}
            </div>
            {(() => {
              const ex = energy?.hotspots?.find((h) => typeof h.label === "string" && h.label.trim().length > 0);
              if (!ex) return null;
              return (
                <div className="mt-2 text-xs text-gray-700">
                  <span className="text-gray-600">Example:</span>
                  <span className="ml-1 font-semibold text-gray-900">You stressed {ex.label} — great emphasis!</span>
                </div>
              );
            })()}
          </div>
          {/* Coaching translation layer: Pauses & Rhythm */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Pauses & Rhythm (coaching)</h4>
            {/* Speedometer */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-[220px] h-[120px]">
                {(() => {
                  const wpm = calculateWpm();
                  const minW = 80;
                  const maxW = 220;
                  const value = typeof wpm === "number" ? Math.max(minW, Math.min(wpm, maxW)) : 0;
                  return (
                    <Gauge value={value - minW} max={maxW - minW} label={`${wpm ?? "—"} WPM`} />
                  );
                })()}
              </div>
              {/* Pause highlights and Talk vs Pause pie */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">Long silences</div>
                  <ul className="text-xs text-gray-800 space-y-1">
                    {(metrics.pauseHighlights || []).slice(0, 3).map((p, i) => (
                      <li key={`ph-${i}`}>
                        <span className="text-gray-800 font-semibold">{formatDuration(p.start)}–{formatDuration(p.end)}:</span>
                        <span className="ml-1">This {p.duration}s pause felt like you lost track.</span>
                      </li>
                    ))}
                    {(!metrics.pauseHighlights || metrics.pauseHighlights.length === 0) && (
                      <li className="text-gray-500">No long pauses detected.</li>
                    )}
                  </ul>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const dur = metrics.durationSec || 0;
                    const pause = metrics.totalPauseTimeSec || 0;
                    const talk = Math.max(0, dur - pause);
                    const fracTalk = dur > 0 ? talk / dur : 0;
                    const fracPause = 1 - fracTalk;
                    const r = 28;
                    const c = 2 * Math.PI * r;
                    return (
                      <svg viewBox="0 0 80 80" className="w-16 h-16">
                        <circle cx="40" cy="40" r={r} stroke="#E5E7EB" strokeWidth="10" fill="none" />
                        <circle
                          cx="40" cy="40" r={r} stroke="#10B981" strokeWidth="10" fill="none"
                          strokeDasharray={`${c * fracTalk} ${c}`}
                          transform="rotate(-90 40 40)"
                        />
                      </svg>
                    );
                  })()}
                  <div className="text-xs text-gray-700">
                    <div>
                      <span className="text-gray-600">Talk vs pause:</span>
                      <span className="ml-1 font-semibold text-gray-900">{metrics.pauseRatioPercent != null ? `${Math.round(100 - metrics.pauseRatioPercent)}% talk / ${metrics.pauseRatioPercent}% pause` : "—"}</span>
                    </div>
                    <div className="text-gray-500 italic">Tip: Good speakers give ~20% silence.</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Tempo stability sparkline */}
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-700 mb-1">Rhythm over time</div>
              <div className="flex items-center gap-3">
                {(() => {
                  const rates = metrics.ratesWps || [];
                  const windowSec = metrics.rateWindowSec || 5;
                  const w = 260, h = 60, pad = 4;
                  if (rates.length === 0) return <div className="text-xs text-gray-500">Not enough data</div>;
                  const maxRate = Math.max(2, Math.max(...rates, 0)); // words/sec
                  const points = rates.map((r, i) => {
                    const x = pad + (i / Math.max(1, rates.length - 1)) * (w - 2 * pad);
                    const y = h - pad - (clamp(r, 0, maxRate) / maxRate) * (h - 2 * pad);
                    return `${x},${y}`;
                  }).join(" ");
                  return (
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-[260px] h-[60px]">
                      <polyline points={points} fill="none" stroke="#3B82F6" strokeWidth="2" />
                    </svg>
                  );
                })()}
                <div className="text-xs text-gray-700">
                  <div>
                    <span className="text-gray-600">Stability:</span>
                    <span className="ml-1 font-semibold text-gray-900">{metrics.tempoStdDevWps != null ? (metrics.tempoStdDevWps <= 0.2 ? "Smooth flow" : "Choppy delivery") : "—"}</span>
                  </div>
                  <div className="text-gray-500">Based on words/sec over time.</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Pauses and rhythm (no DSP)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
              <div>
                <span className="text-gray-600">Inter-word gap (avg):</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.avgGapSec === "number" ? `${metrics.avgGapSec}s` : "—"}</span>
              </div>
              <div>
                <span className="text-gray-600">Inter-word gap (median):</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.medianGapSec === "number" ? `${metrics.medianGapSec}s` : "—"}</span>
              </div>
              <div>
                <span className="text-gray-600">Medium pauses (0.6–1.5s):</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.mediumPauseCount === "number" ? metrics.mediumPauseCount : "—"}</span>
              </div>
              <div>
                <span className="text-gray-600">Long pauses (≥1.5s):</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.longPauseCount === "number" ? metrics.longPauseCount : "—"}</span>
              </div>
              <div>
                <span className="text-gray-600">Pause ratio:</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.pauseRatioPercent === "number" ? `${metrics.pauseRatioPercent}%` : "—"}</span>
              </div>
              <div>
                <span className="text-gray-600">Tempo stability (stddev words/sec, 5s):</span>
                <span className="ml-1 font-semibold text-gray-900">{typeof metrics.tempoStdDevWps === "number" ? metrics.tempoStdDevWps : "—"}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Energy (stress/emphasis)</h4>
            {isAnalyzingEnergy && (
              <div className="text-xs text-gray-600">Analyzing energy…</div>
            )}
            {energyError && (
              <div className="text-xs text-red-600">{energyError}</div>
            )}
            {energy && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                <div>
                  <span className="text-gray-600">Energy variability (std/mean):</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.variability ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Hotspots:</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.hotspots.length}</span>
                </div>
                {energy.hotspots.slice(0, 5).map((h, idx) => (
                  <div key={`hs-${idx}`} className="col-span-1 sm:col-span-2 text-gray-700">
                    <span className="text-gray-600">• {formatDuration(h.start)}–{formatDuration(h.end)}:</span>
                    <span className="ml-1 font-medium text-gray-900">{h.label ?? "emphasis"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {energy?.pitch && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Pitch (intonation)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                <div>
                  <span className="text-gray-600">Valid F0 frames:</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.pitch.validCount}</span>
                </div>
                <div>
                  <span className="text-gray-600">Pitch range (P95−P5):</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.pitch.rangeHz ?? "—"} Hz</span>
                </div>
                <div>
                  <span className="text-gray-600">Pitch variance:</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.pitch.variance ?? "—"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Monotony index:</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.pitch.monotonyIndex ?? "—"}</span>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <span className="text-gray-600">End-of-sentence slope (avg):</span>
                  <span className="ml-1 font-semibold text-gray-900">{energy.pitch.eosAverageSlopeHzPerSec ?? "—"} Hz/s</span>
                </div>
              </div>
              {/* Pitch coaching UI */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Expressiveness dial */}
                <div className="w-[220px] h-[120px]">
                  {(() => {
                    const range = energy.pitch?.rangeHz ?? null;
                    const minR = 10, maxR = 150;
                    const value = typeof range === "number" ? Math.max(minR, Math.min(range, maxR)) : 0;
                    return (
                      <Gauge value={value - minR} max={maxR - minR} label={`${range ?? "—"} Hz`} />
                    );
                  })()}
                </div>
                {/* Monotony comparison */}
                <div className="text-xs text-gray-700">
                  <div className="mb-1">
                    <span className="text-gray-600">Monotony:</span>
                    <span className="ml-1 font-medium text-gray-900">{monotonyCompareText(energy.pitch?.monotonyIndex ?? null)}</span>
                  </div>
                  <div className="text-gray-500">Varied tone makes you sound engaged.</div>
                </div>
              </div>
              {/* End-of-sentence highlights */}
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Sentence endings</div>
                <ul className="text-xs text-gray-800 space-y-1">
                  {(energy.pitch.eosSegments || []).slice(0, 4).map((s, idx) => {
                    const sl = slopeLabel(s.slope);
                    return (
                      <li key={`eos-${idx}`}>
                        <span className="text-gray-800 font-semibold">{formatDuration(s.end)}:</span>
                        <span className="ml-1">This one ended {sl.text} {sl.arrow}.</span>
                      </li>
                    );
                  })}
                  {(!energy.pitch.eosSegments || energy.pitch.eosSegments.length === 0) && (
                    <li className="text-gray-500">No sentence endings detected.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {transcriptionError && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <h3 className="text-sm font-medium text-red-700 mb-2">Transcription Error:</h3>
          <p className="text-sm text-red-600">{transcriptionError}</p>
        </div>
      )}

      <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1">
        <li>Hard cap {MAX_SECONDS}s to keep files small and avoid abuse.</li>
        <li>Secure by default: requires user gesture and HTTPS for mic access.</li>
        <li>Fallback upload works on older iOS/Android if in-page recording is unavailable.</li>
      </ul>
    </div>
  );
}