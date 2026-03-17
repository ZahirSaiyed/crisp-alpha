"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

function tryParseJson(raw: string): unknown | null {
  try { return JSON.parse(raw) } catch {}
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch?.[1]) { try { return JSON.parse(codeBlockMatch[1]) } catch {} }
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) { try { return JSON.parse(jsonMatch[0]) } catch {} }
  const cleaned = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim()
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) { try { return JSON.parse(cleaned) } catch {} }
  return null
}

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
    if (!line) continue;
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
  cursorOnLast,
}: {
  title: string;
  icon: string;
  items: string[];
  accent: string;
  cursorOnLast?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[13px]" style={{ background: accent, color: "white" }}>{icon}</div>
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h3>
      </div>
      <ul className="pl-0 space-y-2 text-[14px] leading-6 text-[var(--ink-light)]">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-[7px] inline-block w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: accent }} />
            <span className="flex-1">
              {renderWithBold(it)}
              {cursorOnLast && i === items.length - 1 && (
                <span className="inline-block w-[2px] h-[13px] bg-[var(--bright-purple)] ml-[1px] align-middle animate-pulse" />
              )}
            </span>
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState<string>("");
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
      setIsStreaming(false);
      setStreamingText("");
      onLoadingChangeRef.current?.(true);
      setError(null);
      setJson(null);
      setText(null);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, maxWords: 500 }),
        });
        if (!res.ok) {
          const raw = await res.json().catch(() => ({} as unknown));
          const j = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
          throw new Error((j.message as string) || (j.error as string) || `Request failed: ${res.status}`);
        }
        if (aborted) return;

        // Switch from spinner to streaming text display
        setLoading(false);
        onLoadingChangeRef.current?.(false);
        setIsStreaming(true);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (aborted) { reader.cancel(); break; }
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          setStreamingText(buf);
        }
        buf += decoder.decode(); // flush

        if (aborted) return;
        setIsStreaming(false);

        // Try to parse accumulated text as JSON
        const parsed = tryParseJson(buf.trim());
        if (parsed && typeof parsed === "object") {
          const data = parsed as Record<string, unknown>;
          if (Array.isArray(data.strengths) || Array.isArray(data.weaknesses) || Array.isArray(data.recommendations)) {
            const s: Structured = {
              strengths: Array.isArray(data.strengths) ? data.strengths as string[] : [],
              weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses as string[] : [],
              recommendations: Array.isArray(data.recommendations) ? data.recommendations as string[] : [],
            };
            if (data.coachInsight && typeof data.coachInsight === "object") {
              s.coachInsight = data.coachInsight as NonNullable<Structured["coachInsight"]>;
            }
            if (typeof data.improvedAnswer === "string") {
              s.improvedAnswer = data.improvedAnswer;
            }
            setJson(s);
            onStructuredRef.current?.(s);
            return;
          }
        }
        // Prose format — set text and emit structured sections if parseable
        setText(buf);
        const proseSections = parseSections(buf);
        if (proseSections) {
          onStructuredRef.current?.({
            strengths: proseSections.strengths,
            weaknesses: proseSections.weaknesses,
            recommendations: proseSections.recommendations,
          });
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        if (!aborted) {
          setIsStreaming(false);
          setError(msg);
        }
      } finally {
        if (!aborted) {
          setLoading(false);
          setIsStreaming(false);
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

  // Derived state for progressive rendering during streaming
  const streamingSections = useMemo(() =>
    isStreaming ? parseSections(streamingText) : null,
    [isStreaming, streamingText]
  );

  const lastStreamingSection = useMemo(() => {
    if (!streamingSections) return null;
    for (const key of ["recommendations", "weaknesses", "strengths"] as const) {
      if (streamingSections[key].length > 0) return key;
    }
    return null;
  }, [streamingSections]);

  return (
    <section className="relative rounded-[var(--radius-lg)] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[var(--muted-2)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--bright-purple)] font-medium">Expert Feedback</div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-light)]">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-[var(--muted-2)] border-t-[var(--bright-purple)] animate-spin" />
          Generating feedback…
        </div>
      )}
      {isStreaming && !streamingSections && (
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-light)]">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-[var(--muted-2)] border-t-[var(--bright-purple)] animate-spin" />
          Analyzing your delivery…
        </div>
      )}
      {isStreaming && streamingSections && (
        <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
          {streamingSections.strengths.length > 0 && (
            <SectionBlock title="Strengths" icon="✅" items={streamingSections.strengths} accent="var(--accent-grn)" cursorOnLast={lastStreamingSection === "strengths"} />
          )}
          {streamingSections.weaknesses.length > 0 && (
            <SectionBlock title="Weaknesses" icon="⚠️" items={streamingSections.weaknesses} accent="var(--intent-decisive)" cursorOnLast={lastStreamingSection === "weaknesses"} />
          )}
          {streamingSections.recommendations.length > 0 && (
            <SectionBlock title="Recommendations" icon="🛠️" items={streamingSections.recommendations} accent="var(--bright-purple)" cursorOnLast={lastStreamingSection === "recommendations"} />
          )}
        </div>
      )}
      {error && (
        <div className="text-[13px] text-[var(--bad)]">{error}</div>
      )}
      {!loading && !isStreaming && !error && (
        sections ? (
          <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
            <SectionBlock title="Strengths" icon="✅" items={sections.strengths} accent="var(--accent-grn)" />
            <SectionBlock title="Weaknesses" icon="⚠️" items={sections.weaknesses} accent="var(--intent-decisive)" />
            <SectionBlock title="Recommendations" icon="🛠️" items={sections.recommendations} accent="var(--bright-purple)" />
          </div>
        ) : (
          <div className={`prose prose-sm max-w-none text-[var(--ink-light)] ${compact ? "space-y-2" : "space-y-3"}`}>
            {text ? (
              <div className="whitespace-pre-wrap leading-6">{text}</div>
            ) : (
              <div className="text-[13px] text-[var(--ink-light)]">No feedback yet.</div>
            )}
          </div>
        )
      )}
    </section>
  );
} 