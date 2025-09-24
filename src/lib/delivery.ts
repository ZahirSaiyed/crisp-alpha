export type DeliverySummary = {
  wpm: number;
  wpmVariance: number;
  endRushIndex: number;
  pauses: { time: number; duration: number }[];
  strategicPauseCoverage: number;
  pitch: { meanHz: number; rangeHz: number; variability: number };
  volume: { mean: number; range: number; dips: { time: number }[] };
  fillers: { total: number; byType: Record<string, number> };
  energyCurve: { t: number; level: number }[];
  annotations: { t: number; kind: 'rush'|'pause'|'flat'|'strong'; note: string }[];
  durationSec?: number;
};

export type Goal = 'Calm' | 'Authority' | 'Engagement';

export type Takeaway = {
  headline: string;
  subtext: string;
  icon: string;
}; 