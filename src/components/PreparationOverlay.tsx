"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PreparationOverlayProps {
  isVisible: boolean;
  onReady: () => void;
  onStartRecording: () => void;
}

export default function PreparationOverlay({
  isVisible,
  onReady,
  onStartRecording,
}: PreparationOverlayProps) {
  const [showReadyButton, setShowReadyButton] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Show preparation message for 1.5 seconds, then show ready button
      const timer = setTimeout(() => {
        setShowReadyButton(true);
        onReady();
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setShowReadyButton(false);
    }
  }, [isVisible, onReady]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/98 backdrop-blur-md"
        >
          <div className="text-center space-y-6 px-6">
            {!showReadyButton ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-xl sm:text-2xl font-semibold text-[color:var(--ink)] mb-2">
                  Take a breath.
                </p>
                <p className="text-base sm:text-lg text-[color:rgba(11,11,12,0.70)]">
                  You're ready when you are.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="space-y-6"
              >
                <p className="text-lg sm:text-xl font-semibold text-[color:var(--ink)] mb-6">
                  Tap to begin
                </p>
                <button
                  type="button"
                  onClick={onStartRecording}
                  aria-label="Start recording"
                  className="relative w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black transition-all duration-180 hover:scale-105"
                  style={{
                    boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.4), 0 2px 8px rgba(239, 68, 68, 0.15)",
                  }}
                >
                  <style jsx global>{`
                    @keyframes pulse-ring { 
                      from { transform: scale(1); opacity: 0.45; } 
                      to { transform: scale(1.5); opacity: 0; } 
                    }
                  `}</style>
                  <span 
                    className="absolute inset-0 rounded-full" 
                    style={{ 
                      boxShadow: "0 0 0 0 rgba(239,68,68,0.5)", 
                      animation: "pulse-ring 1.6s ease-out infinite" 
                    }} 
                  />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

