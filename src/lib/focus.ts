import { DeliverySummary, Goal } from "./delivery";

export type Focus = "PaceClose" | "Pausing" | "VocalVariety" | "Smoothness" | "ClosingEnergy";

export type DrillConfig = {
  title: string;
  durationSec: number;
  instruction: string;
  segment: "close" | "opener" | "full";
  targets?: { wpmMin?: number; wpmMax?: number; pauseSec?: number };
  snippet?: string;
  snippetHint?: string;
};

function lastSentenceFromTranscript(transcript?: string | null): string | undefined {
  if (!transcript) return undefined;
  const sentences = transcript
    .split(/([.!?])+/)
    .join("")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = sentences[sentences.length - 1];
  if (!last) return undefined;
  const words = last.split(/\s+/).filter(Boolean);
  const tail = words.slice(Math.max(0, words.length - 12)).join(" ");
  return tail;
}

const strongVerbs = ["decide","approve","deliver","grow","reduce","increase","launch","ship","commit","align","clarify","confirm"];
function verbPhraseFromTranscript(transcript?: string | null): string | undefined {
  if (!transcript) return undefined;
  const tokens = transcript.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i]?.replace(/[^A-Za-z']/g, "");
    if (!raw) continue;
    const low = raw.toLowerCase();
    if (strongVerbs.includes(low)) {
      const start = Math.max(0, i - 2);
      const end = Math.min(tokens.length, i + 4);
      const phrase = tokens.slice(start, end).join(" ");
      return phrase;
    }
  }
  return undefined;
}

function numericSentence(transcript?: string | null): string | undefined {
  if (!transcript) return undefined;
  const sentences = transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const s of sentences) {
    if (/\b\d[\d,\.]*%?\b/.test(s)) return s.trim();
  }
  return undefined;
}

export function selectFocus(goal: Goal, s: DeliverySummary, opts?: { transcript?: string | null }): { focus: Focus; drill: DrillConfig } {
  const t = opts?.transcript ?? undefined;

  // 1) Closing Rush
  if (typeof s.endRushIndex === "number" && s.endRushIndex > 0.15) {
    const snip = lastSentenceFromTranscript(t) ?? "This concludes my update. Thank you.";
    return {
      focus: "PaceClose",
      drill: {
        title: "Slow down your close for confidence",
        durationSec: 30,
        instruction: "Deliver your final line, then pause a full second before ending.",
        segment: "close",
        targets: { wpmMin: 140, wpmMax: 160, pauseSec: 1.0 },
        snippet: snip,
        snippetHint: "Your final line",
      },
    };
  }

  // 2) Pausing coverage
  if (typeof s.strategicPauseCoverage === "number" && s.strategicPauseCoverage < 0.4) {
    const snip = numericSentence(t) ?? lastSentenceFromTranscript(t) ?? "We grew 20% last quarter.";
    return {
      focus: "Pausing",
      drill: {
        title: "Give your ideas space to land",
        durationSec: 30,
        instruction: "Say the highlighted phrase, then pause for 0.7–1s before continuing.",
        segment: "full",
        targets: { pauseSec: 0.9 },
        snippet: snip,
        snippetHint: "Pause after the number",
      },
    };
  }

  // 3) Vocal Variety
  if (typeof s?.pitch?.rangeHz === "number" && s.pitch.rangeHz < 80) {
    const snip = verbPhraseFromTranscript(t) ?? "We delivered the project on time.";
    return {
      focus: "VocalVariety",
      drill: {
        title: "Add vocal variety for emphasis",
        durationSec: 30,
        instruction: "Re-read this phrase, lifting your voice on the bold verb.",
        segment: "full",
        targets: { pauseSec: 0.7 },
        snippet: snip,
        snippetHint: "Lift on the verb",
      },
    };
  }

  // 4) Fillers
  if (typeof s?.fillers?.total === "number" && typeof s?.durationSec === "number" && s.durationSec > 0) {
    const fillersPerMin = s.fillers.total / (s.durationSec / 60);
    if (fillersPerMin > 12) {
      const snip = lastSentenceFromTranscript(t) ?? "So, we’ll decide next week.";
      return {
        focus: "Smoothness",
        drill: {
          title: "Make your close smoother, with fewer fillers",
          durationSec: 30,
          instruction: "Re-read this line, aiming for no ‘um/uh/like.’",
          segment: "full",
          targets: { pauseSec: 0.5 },
          snippet: snip.replace(/\b(um|uh|like)\b/gi, "").replace(/\s{2,}/g, " ").trim(),
          snippetHint: "Clean version",
        },
      };
    }
  }

  // 5) Positive baseline (default)
  return {
    focus: "ClosingEnergy",
    drill: {
      title: "Strong delivery — let’s lock it in",
      durationSec: 30,
      instruction: "Re-read your final line once more, with the same confident pace.",
      segment: "close",
      targets: { pauseSec: 1.0 },
      snippet: lastSentenceFromTranscript(t) ?? "This concludes my update. Thank you.",
      snippetHint: "Your final line",
    },
  };
} 