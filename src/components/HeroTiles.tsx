"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function HeroTiles() {
  const ref = useRef<HTMLDivElement | null>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rxSpring = useSpring(rx, { stiffness: 120, damping: 14 });
  const rySpring = useSpring(ry, { stiffness: 120, damping: 14 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width - 0.5;
    const pctY = (e.clientY - rect.top) / rect.height - 0.5;
    rx.set(pctY * -6);
    ry.set(pctX * 6);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div className="relative w-full mx-auto max-w-md">
      <motion.div
        ref={ref}
        className="rounded-[28px] border border-[color:var(--muted-2)] bg-white/70 backdrop-blur-[2px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4 will-change-transform"
        style={{ rotateX: rxSpring, rotateY: rySpring }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div className="rounded-2xl bg-gradient-to-br from-[#7A5CFF] via-[#7A5CFF]/80 to-[#6ED0FF] p-4 text-white font-medium" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          CRISP All‑Stars →
        </motion.div>
        <motion.div className="mt-3 rounded-2xl bg-gradient-to-r from-[#C9FF2F] to-[#6ED0FF] p-4 text-[color:var(--ink)] font-medium" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          Clarity Focus →
        </motion.div>
        <motion.div className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF6B5E] to-[#FFE900] p-4 text-[color:var(--ink)] font-medium" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          Pace Booster →
        </motion.div>
        <motion.div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[color:rgba(11,11,12,0.6)]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">135 WPM</div>
          <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">Energy ↑</div>
          <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">Pauses ↓</div>
        </motion.div>
      </motion.div>
    </div>
  );
} 