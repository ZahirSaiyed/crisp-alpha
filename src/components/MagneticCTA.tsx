"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";

export default function MagneticCTA({ href, children, disabled = false, loading = false, onClick }: { href?: string; children: React.ReactNode; disabled?: boolean; loading?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const dxS = useSpring(dx, { stiffness: 200, damping: 20, mass: 0.4 });
  const dyS = useSpring(dy, { stiffness: 200, damping: 20, mass: 0.4 });
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
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

  function handleClick(e: React.MouseEvent) {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = (e as React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>).clientX - rect.left;
      const y = (e as React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>).clientY - rect.top;
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x, y }]);
      setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 600);
    }
    onClick?.(e);
  }

  const commonClass = `relative cta-ylw px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold inline-block overflow-hidden ${disabled ? "opacity-60 cursor-not-allowed" : ""}`;

  const Content = (
    <>
      {children}
      {loading && (
        <span className="ml-2 inline-flex items-center align-middle" aria-hidden>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:rgba(11,11,12,0.9)]" />
        </span>
      )}
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
    </>
  );

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ x: dxS, y: dyS }} className="inline-block">
      {href ? (
        <Link href={disabled ? "#" : href} onClick={handleClick} className={commonClass} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined}>
          {Content}
        </Link>
      ) : (
        <button type="button" onClick={handleClick} className={commonClass} disabled={disabled}>
          {Content}
        </button>
      )}
      <style jsx>{`
        @keyframes ripple {
          from { transform: scale(1); opacity: 0.6; }
          to { transform: scale(30); opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
} 