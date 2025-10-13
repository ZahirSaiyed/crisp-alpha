"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Token = { word: string; start?: number; end?: number };

type Sections = {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

type Structured = Sections & { coachInsight?: { headline?: string; subtext?: string }; improvedAnswer?: string };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const maybe = (e as { message?: unknown }).message;
    if (typeof maybe === "string") return maybe;
  }
  return "Failed to load feedback";
}

function normalizeHeading(line: string): "strengths" | "weaknesses" | "recommendations" | null {
  const t = line.trim().replace(/^\*\*|\*\*$/g, "");
  const low = t.toLowerCase();
  if (/^\*?\*?\s*strengths\s*:?.*$/.test(low)) return "strengths";
  if (/^\*?\*?\s*weaknesses\s*:?.*$/.test(low)) return "weaknesses";
  if (/^\*?\*?\s*recommendations\s*:?.*$/.test(low)) return "recommendations";
  return null;
}

function cleanBullet(line: string): string {
  return line
    .replace(/^[-•*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function parseSections(text: string): Sections | null {
  if (!text || typeof text !== "string") return null;
  const lines = text.split(/\r?\n/);
  const out: Sections = { strengths: [], weaknesses: [], recommendations: [] };
  let current: keyof Sections | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const maybe = normalizeHeading(line);
    if (maybe) {
      current = maybe;
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const isBullet = /^[-•*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
    if (isBullet) {
      (out[current] as string[]).push(cleanBullet(trimmed));
    } else {
      const arr = out[current] as string[];
      if (arr.length === 0) arr.push(trimmed); else arr[arr.length - 1] = `${arr[arr.length - 1]} ${trimmed}`.trim();
    }
  }

  const hasAny = out.strengths.length + out.weaknesses.length + out.recommendations.length > 0;
  return hasAny ? out : null;
}

function renderWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) return <strong key={idx}>{m[1]}</strong>;
    return <span key={idx}>{part}</span>;
  });
}

function SectionBlock({
  title,
  icon,
  items,
  accent,
}: {
  title: string;
  icon: string;
  items: string[];
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[13px]" style={{ background: accent, color: "white" }}>{icon}</div>
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">{title}</h3>
      </div>
      <ul className="pl-0 space-y-2 text-[14px] leading-6 text-[color:rgba(11,11,12,0.85)]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-[7px] inline-block w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: accent }} />
            <span className="flex-1">{renderWithBold(it)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FeedbackTile({
  tokens,
  transcript,
  compact,
  onStructured,
  onLoadingChange,
}: {
  tokens?: Token[] | null;
  transcript?: string | null;
  compact?: boolean;
  onStructured?: (s: Structured) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [json, setJson] = useState<Structured | null>(null);
  const onStructuredRef = useRef<((s: Structured) => void) | undefined>(onStructured);
  const onLoadingChangeRef = useRef<((loading: boolean) => void) | undefined>(onLoadingChange);
  useEffect(() => { onStructuredRef.current = onStructured; }, [onStructured]);
  useEffect(() => { onLoadingChangeRef.current = onLoadingChange; }, [onLoadingChange]);

  const { payload, payloadKey } = useMemo(() => {
    const hasTranscript = typeof transcript === "string" && transcript.trim().length > 0;
    const hasTokens = Array.isArray(tokens) && tokens.length > 0;
    const p = hasTranscript ? { transcript } : (hasTokens ? { tokens } : null);
    const key = hasTranscript
      ? `t:${transcript?.length}:${transcript?.slice(0, 24)}`
      : (hasTokens ? `k:${tokens?.length}:${tokens?.[0]?.word || ""}:${tokens?.[tokens.length - 1]?.word || ""}` : "");
    return { payload: p, payloadKey: key };
  }, [tokens, transcript]);

  const lastKeyRef = useRef<string>("");
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;
    if (!payload) return;

    // Debounce to allow transcript to arrive after tokens
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (aborted) return;
      if (payloadKey && lastKeyRef.current === payloadKey) return; // dedupe identical
      lastKeyRef.current = payloadKey || lastKeyRef.current;

      setLoading(true);
      onLoadingChangeRef.current?.(true);
      setError(null);
      setJson(null);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, maxWords: 500 }),
        });
        const raw = await res.json().catch(() => ({} as unknown));
        if (!res.ok) {
          const j = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
          throw new Error((j.message as string) || (j.error as string) || `Request failed: ${res.status}`);
        }
        const data = (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>))
          ? (raw as { data: unknown }).data as Record<string, unknown>
          : (raw as Record<string, unknown>);
        if (aborted) return;
        if (data && typeof data === "object" && (Array.isArray((data as Record<string, unknown>).strengths) || (data as Record<string, unknown>).coachInsight || (data as Record<string, unknown>).improvedAnswer)) {
          const s: Structured = {
            strengths: Array.isArray((data as Record<string, unknown>).strengths) ? (data as Record<string, unknown>).strengths as string[] : [],
            weaknesses: Array.isArray((data as Record<string, unknown>).weaknesses) ? (data as Record<string, unknown>).weaknesses as string[] : [],
            recommendations: Array.isArray((data as Record<string, unknown>).recommendations) ? (data as Record<string, unknown>).recommendations as string[] : [],
            coachInsight: (data as Record<string, unknown>).coachInsight as Structured["coachInsight"] | undefined,
            improvedAnswer: typeof (data as Record<string, unknown>).improvedAnswer === "string" ? (data as Record<string, unknown>).improvedAnswer as string : undefined,
          };
          setJson(s);
          onStructuredRef.current?.(s);
        } else {
          const fb = (data && typeof data === "object") ? (data as Record<string, unknown>).feedback : undefined;
          setText(typeof fb === "string" ? fb : "");
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        if (!aborted) setError(msg);
      } finally {
        if (!aborted) {
          setLoading(false);
          onLoadingChangeRef.current?.(false);
        }
      }
    }, 300);

    return () => {
      aborted = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [payload, payloadKey]);

  const sections = useMemo(() => json ? ({ strengths: json.strengths || [], weaknesses: json.weaknesses || [], recommendations: json.recommendations || [] }) : parseSections(text || ""), [json, text]);

  return (
    <section className="relative rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)]">Expert Feedback</div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-[color:var(--muted-2)] text-[color:rgba(11,11,12,0.55)]">Auto‑generated</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-[color:rgba(11,11,12,0.65)]">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-[color:var(--muted-2)] border-t-[color:var(--bright-purple)] animate-spin" />
          Generating feedback…
        </div>
      )}
      {error && (
        <div className="text-[13px] text-[color:#8A1C1C]">{error}</div>
      )}
      {!loading && !error && (
        sections ? (
          <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
            <SectionBlock title="Strengths" icon="✅" items={sections.strengths} accent="var(--accent-grn)" />
            <SectionBlock title="Weaknesses" icon="⚠️" items={sections.weaknesses} accent="#F59E0B" />
            <SectionBlock title="Recommendations" icon="🛠️" items={sections.recommendations} accent="var(--bright-purple)" />
          </div>
        ) : (
          <div className={`prose prose-sm max-w-none text-[color:rgba(11,11,12,0.85)] ${compact ? "space-y-2" : "space-y-3"}`}>
            {text ? (
              <div className="whitespace-pre-wrap leading-6">{text}</div>
            ) : (
              <div className="text-[13px] text-[color:rgba(11,11,12,0.65)]">No feedback yet.</div>
            )}
          </div>
        )
      )}
    </section>
  );
} 