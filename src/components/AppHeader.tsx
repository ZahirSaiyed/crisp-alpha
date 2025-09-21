"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import React from "react";

export default function AppHeader() {
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 200], [0.7, 0.9]);
  const bg = useMotionTemplate`rgba(255,255,255,${bgOpacity})`;
  const shadow = useTransform(scrollY, [0, 80], [
    "0 10px 30px rgba(0,0,0,0)",
    "0 10px 30px rgba(0,0,0,0.08)",
  ]);
  const height = useTransform(scrollY, [0, 200], [72, 60]);

  return (
    <motion.header
      className="sticky top-0 z-50 border-b border-[color:var(--muted-2)] backdrop-blur-[6px]"
      style={{
        backgroundColor: bg,
        boxShadow: shadow,
        height,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 h-full flex items-center">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
          <Link href="/" className="display-wordmark text-[color:var(--electric-pink)] text-3xl sm:text-5xl font-semibold tracking-wide">
            CRISP
          </Link>
        </motion.div>
        <div className="ml-auto hidden sm:block text-sm text-[color:rgba(11,11,12,0.6)]">
          Train smarter.
        </div>
      </div>
      <MotionProgressBar />
    </motion.header>
  );
}

function MotionProgressBar() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="absolute left-0 right-0 top-full h-[3px] origin-left"
      style={{ scaleX: scrollYProgress, background: "linear-gradient(90deg, var(--bright-lime), var(--bright-purple))" }}
    />
  );
} 