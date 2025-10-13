"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { computeWpmTimeline, detectPauses, WordToken } from "../lib/analysis";

export default function TimelineStrip({ tokens, durationSec, corridor = { minWpm: 140, maxWpm: 160 }, modeDefault = "simple", onSeek, volume }: { tokens: WordToken[]; durationSec: number; corridor?: { minWpm: number; maxWpm: number }; modeDefault?: "simple" | "advanced"; onSeek?: (t: number) => void; volume?: Array<{ t: number; level: number }>; }) {
  const [mode, setMode] = useState<"simple"|"advanced">(modeDefault);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [annIdx, setAnnIdx] = useState<number>(0);

  const wpmSeries = useMemo(() => computeWpmTimeline(tokens, 5), [tokens]);
  const pauses = useMemo(() => detectPauses(tokens, 0.5), [tokens]);

  const annotations = useMemo(() => {
    const anns: Array<{ t: number; label: string }> = [];
    if (wpmSeries.length > 0) {
      const values = wpmSeries.map((p) => p.wpm);
      const med = values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)] || 0;
      const top = wpmSeries.reduce<{ t: number; wpm: number } | null>((best, p) => (p.wpm > (best?.wpm ?? -1) ? p : best), null);
      if (top && top.wpm > med * 1.25) anns.push({ t: top.t, label: "Rush spike here" });
    }
    const topPauses = pauses.slice().sort((a,b)=>b.duration-a.duration).slice(0,2);
    for (const p of topPauses) anns.push({ t: p.time, label: `Pause ${p.duration.toFixed(1)}s` });
    return anns.slice(0, 3);
  }, [wpmSeries, pauses]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const widthCss = canvas.clientWidth;
    const heightCss = canvas.clientHeight;
    canvas.width = Math.floor(widthCss * dpr);
    canvas.height = Math.floor(heightCss * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthCss, heightCss);

    const minW = corridor.minWpm, maxW = corridor.maxWpm;
    const series = wpmSeries;
    const wMax = Math.max(maxW, ...series.map((p) => p.wpm), 1);
    const wMin = Math.min(minW, ...series.map((p) => p.wpm), 0);
    const pad = 6;
    const yFor = (wpm: number) => {
      const r = (wpm - wMin) / Math.max(1e-6, (wMax - wMin));
      return heightCss - pad - r * (heightCss - 2 * pad);
    };
    const xFor = (t: number) => (t / Math.max(1e-6, durationSec)) * widthCss;

    ctx.fillStyle = "rgba(122,92,255,0.12)";
    const yTop = yFor(maxW);
    const yBot = yFor(minW);
    ctx.fillRect(0, Math.min(yTop, yBot), widthCss, Math.abs(yBot - yTop));

    // Advanced overlays: volume envelope
    if (mode === "advanced" && Array.isArray(volume) && volume.length > 0) {
      ctx.fillStyle = "rgba(110,208,255,0.25)"; // subtle blue band
      ctx.beginPath();
      for (let i = 0; i < volume.length; i++) {
        const v = volume[i];
        if (!v) continue;
        const x = xFor(v.t);
        const y = heightCss - pad - Math.min(1, Math.max(0, v.level)) * (heightCss - 2 * pad);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(widthCss, heightCss - pad);
      ctx.lineTo(0, heightCss - pad);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(11,11,12,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const p = series[i];
      if (!p) continue;
      const x = xFor(p.t);
      const y = yFor(p.wpm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const p of pauses) {
      const x = xFor(p.time);
      const y = heightCss - pad;
      ctx.fillStyle = "#0EA5E9";
      ctx.beginPath();
      ctx.arc(x, y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mode === "simple") {
      ctx.fillStyle = "rgba(11,11,12,0.9)";
      ctx.font = "12px ui-sans-serif, system-ui";
      for (const a of annotations) {
        const x = xFor(a.t);
        const label = a.label;
        const textW = ctx.measureText(label).width;
        const boxW = textW + 10;
        const boxH = 18;
        const bx = Math.max(4, Math.min(widthCss - boxW - 4, x - boxW / 2));
        const by = pad;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(11,11,12,0.9)";
        ctx.fillText(label, bx + 5, by + 12);
      }
    }
  }, [wpmSeries, pauses, durationSec, mode, corridor, annotations, volume]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (annotations.length === 0) return;
      if (e.key === "ArrowRight") setAnnIdx((i) => (i + 1) % annotations.length);
      if (e.key === "ArrowLeft") setAnnIdx((i) => (i - 1 + annotations.length) % annotations.length);
      if (e.key === "Enter") onSeek?.(annotations[annIdx]?.t ?? 0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotations, annIdx, onSeek]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-[color:rgba(11,11,12,0.65)]">Timeline</div>
        <div className="text-xs flex gap-1 items-center">
          <button type="button" className={`px-2 py-1 rounded ${mode === "simple" ? "bg-[rgba(0,0,0,0.06)]" : ""}`} onClick={() => setMode("simple")}>Simple</button>
          <button type="button" className={`px-2 py-1 rounded ${mode === "advanced" ? "bg-[rgba(0,0,0,0.06)]" : ""}`} onClick={() => setMode("advanced")}>Advanced</button>
        </div>
      </div>
      <div className="w-full h-[88px] rounded-[12px] border border-[color:var(--muted-2)] bg-white overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      {annotations.length > 0 && (
        <div className="mt-2 text-xs text-[color:rgba(11,11,12,0.65)]">
          <span>Hints: ←/→ to select annotations, Enter to play from marker.</span>
        </div>
      )}
    </div>
  );
} 