"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import React, { useEffect, useState } from "react";

export default function AppHeader() {
  const [mounted, setMounted] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 200], [0.7, 0.9]);
  const bg = useMotionTemplate`rgba(255,255,255,${bgOpacity})`;
  const shadow = useTransform(scrollY, [0, 80], [
    "0 10px 30px rgba(0,0,0,0)",
    "0 10px 30px rgba(0,0,0,0.08)",
  ]);
  const height = useTransform(scrollY, [0, 200], [72, 60]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.header
      className="sticky top-0 z-50 border-b border-[color:var(--muted-2)] backdrop-blur-[6px]"
      style={mounted ? {
        backgroundColor: bg,
        boxShadow: shadow,
        height,
      } : {
        backgroundColor: 'rgba(255,255,255,0.7)',
        boxShadow: '0 10px 30px rgba(0,0,0,0)',
        height: 72,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 h-full flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
          <Link href="/" className="display-wordmark text-[color:var(--electric-pink)] text-3xl sm:text-5xl font-semibold tracking-wide">
            CRISP
          </Link>
        </motion.div>
        <div className="ml-auto hidden sm:flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-sm text-[color:rgba(11,11,12,0.6)] hover:text-[color:var(--ink)] transition-colors"
          >
            Privacy
          </Link>
          <a
            href="#waitlist"
            className="px-4 py-2 rounded-full font-semibold text-[13px]"
            style={{ background: "var(--bright-purple)", color: "white", boxShadow: "0 10px 28px rgba(122,92,255,0.28)" }}
          >
            Get on the waitlist
          </a>
        </div>
      </div>
      <MotionProgressBar />
    </motion.header>
  );
}

function MotionProgressBar() {
  const { scrollYProgress } = useScroll();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      className="absolute left-0 right-0 top-full h-[3px] origin-left"
      style={{ 
        scaleX: mounted ? scrollYProgress : 0, 
        background: "linear-gradient(90deg, var(--bright-lime), var(--bright-purple))" 
      }}
    />
  );
} 