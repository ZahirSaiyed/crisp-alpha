export type WordToken = { word: string; start?: number; end?: number };

export function computeWpmTimeline(words: WordToken[], windowSec = 5): Array<{ t: number; wpm: number }> {
  const tokens = words.filter((w) => typeof w.start === "number");
  if (tokens.length === 0) return [];
  const duration = Math.max(...tokens.map((w) => (w.end ?? w.start!) as number));
  const step = Math.max(0.25, windowSec / 5); // sample every ~1s default
  const out: Array<{ t: number; wpm: number }> = [];
  for (let t = windowSec / 2; t <= duration; t += step) {
    const t0 = Math.max(0, t - windowSec / 2);
    const t1 = Math.min(duration, t + windowSec / 2);
    const count = tokens.filter((w) => (w.start as number) >= t0 && (w.start as number) < t1).length;
    const minutes = Math.max(1e-6, (t1 - t0) / 60);
    const wpm = count / minutes;
    out.push({ t, wpm });
  }
  return out;
}

export function detectPauses(words: WordToken[], minGapSec = 0.5) {
  const tokens = words.filter((w) => typeof w.start === "number" && typeof w.end === "number").sort((a, b) => (a.start as number) - (b.start as number));
  const pauses: Array<{ time: number; duration: number }> = [];
  for (let i = 1; i < tokens.length; i++) {
    const prev = tokens[i - 1];
    const curr = tokens[i];
    const gap = (curr.start as number) - (prev.end as number);
    if (gap >= minGapSec) {
      pauses.push({ time: prev.end as number, duration: gap });
    }
  }
  return pauses;
}

export function strategicPauseCoverage(words: WordToken[], pauses: Array<{ time: number; duration: number }>, threshold = 0.6, windowAfterSec = 1.2): number {
  const tokens = words.filter((w) => typeof w.start === "number" && typeof w.end === "number");
  if (tokens.length === 0) return 0;
  const numericIdxs: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    const text = (w.word || "").toString();
    if (/\b\d[\d,\.]*%?\b/.test(text)) numericIdxs.push(i);
  }
  if (numericIdxs.length === 0) return 0;
  let withPause = 0;
  for (const idx of numericIdxs) {
    const tok = tokens[idx];
    const endT = tok.end as number;
    const has = pauses.some((p) => p.duration >= threshold && p.time >= endT && p.time <= endT + windowAfterSec);
    if (has) withPause += 1;
  }
  return withPause / numericIdxs.length;
}

// Filler word detection
const FILLER_SINGLES = new Set(["um","uh","like","actually","basically","literally","so","okay","right","well"]);

function isFillerBigram(prev: string, curr: string): boolean {
  const p = (prev || "").toLowerCase();
  const c = (curr || "").toLowerCase();
  return p === "you" && c === "know";
}

export function detectFillerCounts(words: Array<{ word: string }>): { total: number; byType: Record<string, number>; mostCommon: string | null } {
  const byType: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    const w = (words[i]?.word || "").toLowerCase();
    const prev = i > 0 ? (words[i - 1]?.word || "").toLowerCase() : "";
    if (FILLER_SINGLES.has(w)) {
      total += 1;
      byType[w] = (byType[w] || 0) + 1;
    } else if (isFillerBigram(prev, w)) {
      const key = "you know";
      total += 1;
      byType[key] = (byType[key] || 0) + 1;
    }
  }
  let mostCommon: string | null = null;
  let max = -1;
  for (const [k, v] of Object.entries(byType)) {
    if (v > max) { max = v; mostCommon = k; }
  }
  return { total, byType, mostCommon };
} 