"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

export default function HeroHeadline({
  prefix,
  emphasis,
  subtitle,
}: {
  prefix: string;
  emphasis: string;
  subtitle: string;
}) {
  const text = `${prefix} ${emphasis}`.trim();
  const letters = useMemo(() => Array.from(text), [text]);

  const container = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.035, delayChildren: 0.02 },
    },
  } as const;

  const charVariant = {
    hidden: { y: 10, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
  } as const;

  return (
    <div className="text-left">
      <motion.h1
        className="display-headline display-ps-900 text-groovy text-[72px] sm:text-[96px] lg:text-[112px] leading-[0.98] tracking-[-0.01em]"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {letters.map((ch, i) =>
          ch === " " ? (
            <span key={`sp-${i}`} className="inline-block mx-[0.15em]" aria-hidden>
              &nbsp;
            </span>
          ) : (
            <motion.span key={`ch-${i}`} className="inline-block" variants={charVariant}>
              {ch}
            </motion.span>
          )
        )}
      </motion.h1>
      <motion.p
        className="mt-6 text-xl sm:text-2xl text-[color:rgba(11,11,12,0.8)] max-w-3xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        {subtitle}
      </motion.p>
    </div>
  );
} 