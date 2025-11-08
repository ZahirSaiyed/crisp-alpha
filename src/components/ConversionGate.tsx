"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import posthog from "posthog-js";

interface ConversionGateProps {
  isVisible: boolean;
  onContinue: () => void;
}

export default function ConversionGate({ isVisible, onContinue }: ConversionGateProps) {
  const handleContinue = () => {
    posthog.capture("conversion_gate_clicked");
    onContinue();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Blur overlay */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-md z-40"
          />

          {/* Conversion message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 max-w-md w-full text-center space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-[color:var(--ink)]">
                Continue your session in Crisp.
              </h2>
              <p className="text-base text-[color:rgba(11,11,12,0.7)]">
                See how you sound with real-time feedback and insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/record"
                  onClick={handleContinue}
                  className="px-6 py-3 rounded-full font-semibold bg-[color:var(--intent-persuasive)] text-white shadow-[0_4px_12px_rgba(124,58,237,0.25)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.35)] transition-all duration-200"
                >
                  Keep going →
                </Link>
                <Link
                  href="/signup"
                  onClick={handleContinue}
                  className="px-6 py-3 rounded-full font-semibold border-2 border-[color:var(--muted-2)] text-[color:var(--ink)] hover:border-[color:var(--intent-persuasive)]/50 transition-all duration-200"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

