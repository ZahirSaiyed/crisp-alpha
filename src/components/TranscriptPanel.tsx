"use client";

import React from "react";
import { WordToken } from "../lib/analysis";

const fillers = new Set(["um","uh","like"]);

type Paragraph = { text: string; start?: number; end?: number };

export default function TranscriptPanel({ tokens, pauses, onSeek, paragraphs, transcript }: { tokens?: WordToken[]; pauses: Array<{ time: number; duration: number }>; onSeek?: (t: number) => void; paragraphs?: Paragraph[] | null; transcript?: string | null; }) {
  const paras = Array.isArray(paragraphs) ? paragraphs.filter((p) => (p?.text || "").trim().length > 0) : [];
  if (paras.length > 0) {
    return (
      <div className="rounded-[12px] border border-[color:var(--muted-2)] bg-white p-4">
        <h2 className="text-base font-semibold mb-2">Transcript</h2>
        <div className="text-sm leading-7 max-h-60 overflow-auto space-y-4">
          {paras.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap">
              <button type="button" className="text-[10px] mr-2 px-1 py-0.5 rounded border border-[color:var(--muted-2)] bg-white text-[color:rgba(11,11,12,0.6)]" onClick={() => { if (typeof p.start === "number") onSeek?.(p.start); }}>▶</button>
              {p.text}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (typeof transcript === "string" && transcript.trim().length > 0) {
    return (
      <div className="rounded-[12px] border border-[color:var(--muted-2)] bg-white p-4">
        <h2 className="text-base font-semibold mb-2">Transcript</h2>
        <div className="text-sm leading-7 max-h-60 overflow-auto whitespace-pre-wrap">
          {transcript}
        </div>
      </div>
    );
  }

  const toks = Array.isArray(tokens) ? tokens : [];
  return (
    <div className="rounded-[12px] border border-[color:var(--muted-2)] bg-white p-4">
      <h2 className="text-base font-semibold mb-2">Transcript</h2>
      <div className="text-sm leading-7 max-h-60 overflow-auto">
        {toks.map((w, i) => {
          const text = w.word || "";
          const low = text.toLowerCase();
          const isFill = fillers.has(low);
          const isNum = /\b\d[\d,\.]*%?\b/.test(text);
          const mid = typeof w.start === "number" && typeof w.end === "number" ? (w.start + w.end) / 2 : undefined;
          const nearPause = typeof mid === "number" && pauses.some((p) => Math.abs(p.time - mid) < 0.6);
          const cls = `${isFill ? "underline decoration-[color:#FF5C5C]" : ""} ${isNum ? "font-semibold" : ""}`;
          return (
            <button key={i} type="button" className={`inline-block rounded hover:bg-[rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-[color:var(--muted-2)] px-0.5 ${cls}`} onClick={() => { if (typeof w.start === "number") onSeek?.(w.start); }}>
              {text}
              {nearPause && <span className="ml-1 text-[10px] align-middle">⏸</span>}
              <span> </span>
            </button>
          );
        })}
      </div>
    </div>
  );
} 