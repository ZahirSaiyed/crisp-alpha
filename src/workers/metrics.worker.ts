import * as Comlink from "comlink";

export type CoreSummary = {
  wpmApprox?: number | null;
  endRushIndexApprox?: number | null;
  pauseEvents: Array<{ time: number; duration: number }>;
  computeMs: number;
  ok: boolean;
  error?: string;
};

function computePausesFromRms(pcm: Float32Array, sr: number) {
  const winSec = 0.02;
  const hopSec = 0.01;
  const frame = Math.max(1, Math.round(winSec * sr));
  const hop = Math.max(1, Math.round(hopSec * sr));
  const n = Math.max(0, 1 + Math.floor((pcm.length - frame) / hop));
  const env: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const s = i * hop;
    for (let j = 0; j < frame; j++) {
      const v = pcm[s + j] || 0;
      sum += v * v;
    }
    env.push(Math.sqrt(sum / frame));
  }
  const sorted = [...env].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))] || 1e-9;
  const norm = env.map((v) => v / (p95 || 1e-9));
  const SILENCE = 0.05;
  const minGapSec = 0.5;
  const minFrames = Math.ceil(minGapSec / hopSec);
  const pauses: Array<{ time: number; duration: number }> = [];
  let run = 0;
  for (let i = 0; i < norm.length; i++) {
    const val = norm[i];
    if (val === undefined) continue;
    if (val < SILENCE) {
      run++;
    } else if (run > 0) {
      if (run >= minFrames) {
        const dur = run * hopSec;
        const endT = i * hopSec;
        pauses.push({ time: Math.max(0, endT - dur), duration: dur });
      }
      run = 0;
    }
  }
  if (run >= minFrames) {
    const dur = run * hopSec;
    const endT = norm.length * hopSec;
    pauses.push({ time: Math.max(0, endT - dur), duration: dur });
  }
  return pauses;
}

const api = {
  async computeCoreFromPcm(pcm: Float32Array, sampleRate: number): Promise<CoreSummary> {
    const t0 = performance.now();
    try {
      const pauses = computePausesFromRms(pcm, sampleRate);
      const headLen = Math.max(1, Math.floor(pcm.length * 0.2));
      const tail = pcm.subarray(pcm.length - headLen);
      const head = pcm.subarray(0, headLen);
      const rms = (arr: Float32Array) => {
        let s = 0;
        for (let i = 0; i < arr.length; i++) {
          const val = arr[i];
          if (val !== undefined) s += val * val;
        }
        return Math.sqrt(s / arr.length);
      };
      const endRushIndexApprox = (rms(tail) - rms(head)) / Math.max(1e-6, rms(head));
      const computeMs = Math.round(performance.now() - t0);
      return { ok: true, pauseEvents: pauses, wpmApprox: null, endRushIndexApprox, computeMs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "compute failed";
      return { ok: false, pauseEvents: [], computeMs: Math.round(performance.now() - t0), error: msg };
    }
  },
};

Comlink.expose(api);
export type MetricsWorker = typeof api; 