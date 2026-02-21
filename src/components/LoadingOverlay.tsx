"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function LoadingOverlay({ show, label = "Preparing your insights…" }: { show: boolean; label?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="overlay"
          className="absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full h-full rounded-[var(--radius-lg)] bg-white/90 backdrop-blur"
            initial={{ backdropFilter: "blur(0px)" as unknown as number }}
            animate={{ backdropFilter: "blur(6px)" as unknown as number }}
            exit={{ backdropFilter: "blur(0px)" as unknown as number }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="absolute flex items-center gap-3 text-[14px] text-[var(--ink)]"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.6 }}
            aria-live="polite"
          >
            <SpinnerDots />
            <span>{label}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpinnerDots() {
  const dot = {
    initial: { y: 0, opacity: 0.6 },
    animate: (i: number) => ({
      y: [0, -6, 0],
      opacity: [0.6, 1, 0.6],
      transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.12 },
    }),
  } as const;
  return (
    <div className="flex items-end gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          custom={i}
          variants={dot}
          initial="initial"
          animate="animate"
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: "var(--bright-purple)" }}
        />
      ))}
    </div>
  );
}


