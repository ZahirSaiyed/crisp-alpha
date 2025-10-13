"use client";

import React, { useEffect, useRef, useState } from "react";
import { WordToken } from "../lib/analysis";

function isFillerSequence(prev: string, curr: string): boolean {
  const p = prev.toLowerCase();
  const c = curr.toLowerCase();
  return (p === "you" && c === "know");
}

type Paragraph = { text: string; start?: number; end?: number };

export default function TranscriptPlayerCard({ src, tokens, paragraphs, transcript, onSeek }: { src: string; tokens?: WordToken[] | null; paragraphs?: Paragraph[] | null; transcript?: string | null; onSeek?: (t: number) => void; }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setT(el.currentTime || 0);
    const onMeta = () => {
      if (el.duration === Infinity) {
        const onTU = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) {
            setDur(el.duration);
            el.currentTime = 0;
            el.removeEventListener("timeupdate", onTU);
          }
        };
        el.addEventListener("timeupdate", onTU);
        el.currentTime = Number.MAX_SAFE_INTEGER;
      } else {
        setDur(el.duration && Number.isFinite(el.duration) ? el.duration : 0);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => { el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); el.removeEventListener("play", onPlay); el.removeEventListener("pause", onPause); };
  }, []);

  // Karaoke sync for tokens (autoscroll always on)
  useEffect(() => {
    if (!Array.isArray(tokens) || tokens.length === 0) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const ct = el.currentTime || 0;
      let idx: number | null = null;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) continue;
        const s = typeof token.start === "number" ? token.start as number : -1;
        const e = typeof token.end === "number" ? token.end as number : -1;
        if (s >= 0 && e >= 0 && ct >= s && ct <= e) { idx = i; break; }
      }
      setActiveIdx(idx);
      if (idx != null && containerRef.current) {
        const span = containerRef.current.querySelector(`[data-token-idx='${idx}']`) as HTMLElement | null;
        if (span) {
          span.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [tokens]);

  // Paragraph autoscroll when tokens missing
  useEffect(() => {
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const ct = el.currentTime || 0;
      let idx = -1;
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        if (!paragraph) continue;
        const ps = typeof paragraph.start === "number" ? (paragraph.start as number) : -1;
        if (ps >= 0 && ps <= ct) idx = i; else break;
      }
      if (idx >= 0 && containerRef.current) {
        const pEl = containerRef.current.querySelector(`[data-paragraph-idx='${idx}']`) as HTMLElement | null;
        if (pEl) pEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [paragraphs]);

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  }

  const handleSeek = (sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, dur || el.duration || 0));
    onSeek?.(el.currentTime);
  };

  const paras = Array.isArray(paragraphs) ? paragraphs.filter((p) => (p?.text || "").trim().length > 0) : [];
  const toks = Array.isArray(tokens) ? tokens : [];

  function renderParagraphText(text: string) {
    const re = /(\byou\s+know\b|\bum\b|\buh\b|\blike\b|\bactually\b|\bbasically\b|\bliterally\b|\bso\b|\bokay\b|\bright\b|\bwell\b)/gi;
    const parts = text.split(re);
    return parts.map((part, i) => {
      if (re.test(part)) {
        return (
          <mark key={i} className="bg-[#FFE8E8] text-[#8A1C1C] underline decoration-[#FF5C5C] decoration-2 rounded px-1 py-0.5">
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="rounded-[20px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] bg-white/90 backdrop-blur border border-[color:var(--muted-2)] p-5 sm:p-6">
      <audio ref={audioRef} src={src} className="hidden" />
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:rgba(11,11,12,0.55)] mb-2">Transcript</div>

      <div ref={containerRef} className="text-[15px] sm:text-[16px] leading-7 sm:leading-8 max-h-64 overflow-auto space-y-4">
        {toks.length > 0 ? (
          <p className="whitespace-pre-wrap">
            {toks.map((w, i) => {
              const text = w.word || "";
              const low = text.toLowerCase();
              const isFill = (low === "um" || low === "uh" || low === "like" || low === "actually" || low === "basically" || low === "literally" || low === "so" || low === "okay" || low === "right" || low === "well") || (i > 0 && isFillerSequence(toks[i-1]?.word || "", text));
              const isNum = /\b\d[\d,\.]*(?:%|)\b/.test(text);
              const cls = `${isFill ? "text-[#8A1C1C] bg-[#FFE8E8] underline decoration-[#FF5C5C] decoration-2 rounded px-1" : ""} ${isNum ? "font-semibold" : ""} ${activeIdx === i ? "bg-[rgba(122,92,255,0.12)] rounded" : ""}`;
              return (
                <button key={i} data-token-idx={i} type="button" className={`inline-block rounded hover:bg-[rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[color:var(--muted-2)] px-0.5 ${cls}`} onClick={() => { if (typeof w.start === "number") handleSeek(w.start); }}>
                  {text}
                  <span> </span>
                </button>
              );
            })}
          </p>
        ) : paras.length > 0 ? (
          paras.map((p, i) => (
            <p key={i} data-paragraph-idx={i} className="whitespace-pre-wrap cursor-pointer" onClick={() => { if (typeof p.start === "number") handleSeek(p.start); }}>
              {renderParagraphText(p.text)}
            </p>
          ))
        ) : (
          typeof transcript === "string" && transcript.trim().length > 0 ? (
            <p className="whitespace-pre-wrap">{renderParagraphText(transcript)}</p>
          ) : null
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => (audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause())} className="w-12 h-12 rounded-full flex items-center justify-center shadow-[0_8px_18px_rgba(122,92,255,0.28)] transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-[0.97]" style={{ background: "var(--bright-purple)", color: "white" }}>
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="white"/></svg>
            )}
          </button>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-[color:var(--muted-2)] relative cursor-pointer" onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              handleSeek((dur || 0) * Math.max(0, Math.min(1, frac)));
            }}>
              <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-150 ease-out" style={{ width: `${(dur ? (t / dur) * 100 : 0).toFixed(2)}%`, background: "var(--accent-ylw)" }} />
            </div>
            <div className="flex justify-between text-[11px] text-[color:rgba(11,11,12,0.55)] mt-1 font-mono">
              <span>{fmt(t)}</span>
              <span>{fmt(dur || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 