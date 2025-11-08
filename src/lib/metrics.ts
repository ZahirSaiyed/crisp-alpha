/**
 * Derives normalized scores (0-1) from already-calculated raw metrics.
 * Does NOT recalculate metrics - those are computed in record/page.tsx.
 */

export interface RawMetrics {
  wpm: number;
  fillerCount: number;
  totalWords: number;
  pauseCount: number;
  talkTimeSec: number;
}

export interface DerivedScores {
  clarity_score: number;
  filler_word_rate: number;
  confidence_score: number;
}

export interface SessionMetrics extends DerivedScores {
  pace_wpm: number;
  total_words: number;
  talk_time_sec: number;
  pause_count: number;
}

/**
 * Derives normalized scores from raw metrics.
 * @param rawMetrics - Already-calculated metrics from the recording flow
 * @returns Normalized scores (0-1 scale)
 */
export function deriveScores(rawMetrics: RawMetrics): DerivedScores {
  const { wpm, fillerCount, totalWords } = rawMetrics;

  // Filler word rate: ratio of fillers to total words
  const filler_word_rate = totalWords > 0 ? fillerCount / totalWords : 0;

  // Clarity score: penalize filler usage (0-1 scale)
  // At 0% fillers → 1.0, at 50% fillers → 0.0
  const clarity_score = Math.max(0, Math.min(1, 1 - filler_word_rate * 2));

  // Pacing factor: bell curve centered at ideal pace (140-160 WPM)
  // Peak at 150 WPM, falls off with Gaussian distribution
  const pacing_factor =
    wpm > 0 ? Math.exp(-Math.pow((wpm - 150) / 60, 2)) : 0;

  // Confidence score: weighted composite
  // 70% clarity (low fillers) + 30% pacing (natural speed)
  const confidence_score = clarity_score * 0.7 + pacing_factor * 0.3;

  return {
    clarity_score: Number(clarity_score.toFixed(3)),
    filler_word_rate: Number(filler_word_rate.toFixed(3)),
    confidence_score: Number(confidence_score.toFixed(3)),
  };
}

/**
 * Combines raw metrics with derived scores into a complete session payload.
 * @param rawMetrics - Already-calculated metrics from the recording flow
 * @returns Complete metrics object ready for storage
 */
export function buildSessionMetrics(rawMetrics: RawMetrics): SessionMetrics {
  const derived = deriveScores(rawMetrics);

  return {
    ...derived,
    pace_wpm: Math.round(rawMetrics.wpm),
    total_words: rawMetrics.totalWords,
    talk_time_sec: Number(rawMetrics.talkTimeSec.toFixed(2)),
    pause_count: rawMetrics.pauseCount,
  };
}

