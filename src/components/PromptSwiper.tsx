"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { LazyMotion, domAnimation, m, MotionConfig, useMotionValue, useTransform, AnimatePresence } from "framer-motion";

type Prompt = { id: string; title: string; subtitle?: string | undefined; category?: string | undefined; icon?: string | undefined };

type Dir = "left" | "right";

export default function PromptSwiper({ prompts, onSelect }: { prompts: Prompt[]; onSelect: (p: Prompt) => void }) {
  const [index, setIndex] = useState(0);
  const [enterDir] = useState<Dir>("right");
  const [exitDir] = useState<Dir>("left");
  const deckRef = useRef<HTMLDivElement | null>(null);
  const current = prompts[index];

  const wrap = useCallback((i: number) => (i + prompts.length) % prompts.length, [prompts.length]);
  const goNext = useCallback(() => setIndex((i) => wrap(i + 1)), [wrap]);
  const goPrev = useCallback(() => setIndex((i) => wrap(i - 1)), [wrap]);
  const choose = useCallback((p: Prompt) => { onSelect(p); }, [onSelect]);

  const primaryAction = useCallback(() => {
    if (!current) return;
    choose(current);
  }, [current, choose]);

  function isTextInputFocused(): boolean {
    const ae = (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null);
    if (!ae) return false;
    const tag = ae.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || (ae as HTMLElement).isContentEditable === true;
  }

  useEffect(() => { deckRef.current?.focus(); }, []);

  // Keep parent-selected prompt in sync with the currently visible card
  useEffect(() => {
    if (!current) return;
    onSelect(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id]);

  useEffect(() => {
    function onWinKey(e: KeyboardEvent) {
      if (isTextInputFocused()) return;
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "p") { e.preventDefault(); goPrev(); }
      if (key === "arrowright" || key === "n") { e.preventDefault(); goNext(); }
      if (key === "enter") { e.preventDefault(); primaryAction(); }
    }
    window.addEventListener("keydown", onWinKey);
    return () => window.removeEventListener("keydown", onWinKey);
  }, [goPrev, goNext, primaryAction]);

  useEffect(() => { /* no-op */ }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <div
          ref={deckRef}
          tabIndex={0}
          onMouseEnter={() => deckRef.current?.focus()}
          className="relative h-[300px] sm:h-[340px] select-none rounded-[16px] p-0 focus:outline-none mx-auto w-full max-w-[560px]"
        >
          <div className="absolute left-0 right-0 top-0 bottom-0 z-10 flex items-center justify-center px-3 pt-2">
            <AnimatePresence mode="wait" initial={false}>
              {current && (
                <SwipeCard
                  key={current.id}
                  prompt={current}
                  enterDir={enterDir}
                  exitDir={exitDir}
                  isRecording={false}
                  index={index}
                  total={prompts.length}
                  onSwipeLeft={() => goNext()}
                  onSwipeRight={() => goPrev()}
                  onNext={() => goNext()}
                  onPrev={() => goPrev()}
                  onPrimary={primaryAction}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}

function SwipeCard({ prompt, isRecording, index, total, onSwipeLeft, onSwipeRight, onNext, onPrev, onPrimary, enterDir, exitDir }: { prompt: Prompt; isRecording: boolean; index: number; total: number; onSwipeLeft: () => void; onSwipeRight: () => void; onNext: () => void; onPrev: () => void; onPrimary: () => void; enterDir: Dir; exitDir: Dir }) {
  const x = useMotionValue(0);
  const rot = useTransform(x, [-220, 0, 220], [-8, 0, 8]);

  return (
    <m.div
      className="mx-auto w-full"
      initial={{ opacity: 0, y: 4, x: enterDir === "right" ? 56 : -56, rotate: enterDir === "right" ? 2.5 : -2.5 }}
      animate={{ opacity: 1, y: 0, x: 0, rotate: 0, transition: { type: "spring", stiffness: 520, damping: 20 } }}
      exit={{ opacity: 0, y: -4, x: exitDir === "right" ? -56 : 56, rotate: exitDir === "right" ? -2.5 : 2.5, transition: { duration: 0.12 } }}
    >
      <m.div
        layoutId="promptCard"
        className={`rounded-[16px] border border-[color:var(--muted-2)] bg-white text-[color:var(--ink)] p-5 sm:p-6 shadow-[0_10px_30px_rgba(11,11,12,0.08)] ${isRecording ? "ring-2 ring-red-400 shadow-[0_10px_30px_rgba(255,0,0,0.12)]" : ""}`}
        style={{ x, rotate: rot }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragMomentum
        whileHover={{ y: -1, scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        onDragEnd={(e, info) => {
          const offset = info.offset.x;
          const velocity = info.velocity.x;
          if (Math.abs(offset) > 110 || Math.abs(velocity) > 650) {
            if (offset > 0) onSwipeRight(); else onSwipeLeft();
          } else {
            x.set(0);
          }
        }}
      >
        {/* Header row: goal chip (category) and recording indicator */}
        <div className="flex items-start gap-3 mb-3">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[color:var(--muted-1)] text-[color:rgba(11,11,12,0.65)] border border-[color:var(--muted-2)]">{(prompt.category || "").toUpperCase() || "PROMPT"}</span>
          <div className="w-8 h-8 rounded-full bg-[color:var(--muted-1)] border border-[color:var(--muted-2)] flex items-center justify-center shadow-[inset_0_0_0_2px_rgba(122,92,255,0.12)]">{prompt.icon || "🎯"}</div>
          {/* Recording indicator handled by Recorder UI */}
        </div>

        {/* Headline (aria-live) */}
        <div aria-live="polite" className="min-h-[66px]">
          <h2 className="text-[1.375rem] leading-tight tracking-[-0.01em] text-[color:var(--ink)]">
            {prompt.title}
          </h2>
          {prompt.subtitle && <div className="text-[13px] sm:text-[14px] mt-2 text-[color:rgba(11,11,12,0.70)] leading-relaxed">{prompt.subtitle}</div>}
        </div>

        {/* CTA row */}
        <div className="mt-5 flex items-center gap-3">
          <m.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="flex-1 h-12 rounded-full font-medium text-[14px] shadow-[0_10px_28px_rgba(122,92,255,0.25)] hover:shadow-[0_14px_32px_rgba(122,92,255,0.30)] transition"
            style={{ background: "var(--bright-purple)", color: "white" }}
            onClick={onPrimary}
          >
            Use this prompt
          </m.button>

          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" aria-label="Previous" className="h-8 w-8 rounded-full border border-[color:var(--muted-2)] hover:bg-[color:var(--muted-1)]" onClick={onPrev}>◀︎</button>
            <span className="text-xs text-[color:rgba(11,11,12,0.55)]">{index + 1}/{total}</span>
            <button type="button" aria-label="Next" className="h-8 w-8 rounded-full border border-[color:var(--muted-2)] hover:bg-[color:var(--muted-1)]" onClick={onNext}>▶︎</button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
} 