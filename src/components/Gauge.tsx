"use client";

import { motion } from "framer-motion";

export default function Gauge({ value, max, label, color = "#22c55e", trackColor = "#e5e7eb" }: { value: number; max: number; label?: string; color?: string; trackColor?: string }) {
  const clamped = Math.max(0, Math.min(value, max));
  const circumference = 283; // approximate length of semi-circle path used below
  const offset = circumference - (circumference * clamped) / max;

  return (
    <div className="relative w-56 h-28">
      <svg viewBox="0 0 200 100" className="w-full h-full">
        <path
          d="M10,100 A90,90 0 0,1 190,100"
          fill="none"
          stroke={trackColor}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <motion.path
          d="M10,100 A90,90 0 0,1 190,100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-900"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {typeof label === "string" ? label : `${clamped} / ${max}`}
      </motion.div>
    </div>
  );
} 