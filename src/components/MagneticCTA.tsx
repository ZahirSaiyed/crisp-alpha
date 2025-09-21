"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";

export default function MagneticCTA({ href, children }: { href: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const dxS = useSpring(dx, { stiffness: 200, damping: 20, mass: 0.4 });
  const dyS = useSpring(dy, { stiffness: 200, damping: 20, mass: 0.4 });
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width - 0.5;
    const pctY = (e.clientY - rect.top) / rect.height - 0.5;
    dx.set(pctX * 8);
    dy.set(pctY * 8);
  }

  function onLeave() {
    dx.set(0);
    dy.set(0);
  }

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((rs) => [...rs, { id, x, y }]);
    setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 600);
  }

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ x: dxS, y: dyS }} className="inline-block">
      <Link href={href} onClick={onClick} className="relative cta-ylw px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold inline-block overflow-hidden">
        {children}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute block rounded-full"
            style={{
              left: r.x - 2,
              top: r.y - 2,
              width: 4,
              height: 4,
              background: "rgba(0,0,0,0.15)",
              animation: "ripple 600ms ease-out",
            }}
          />
        ))}
      </Link>
      <style jsx>{`
        @keyframes ripple {
          from { transform: scale(1); opacity: 0.6; }
          to { transform: scale(30); opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
} 