"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import RecordingControls from "./RecordingControls";
import MicPermissionModal from "./MicPermissionModal";
import { getIntentTheme } from "../lib/intentTheme";
import type { Intent } from "./ScenarioInput";

type Prompt = {
  id: string;
  title: string;
  subtitle?: string | undefined;
  category?: string | undefined;
  icon?: string | undefined;
};

type RecordingState = "idle" | "arming" | "recording";

interface RecordingTakeoverProps {
  isOpen: boolean;
  prompt: Prompt | null;
  scenario: string | null;
  intent: Intent | null;
  stream: MediaStream | null;
  recordingState: RecordingState;
  elapsed: number;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onRequestPermission: () => void;
  permissionState: "prompt" | "denied" | null;
  isSilent?: boolean;
}

export default function RecordingTakeover({
  isOpen,
  prompt,
  scenario,
  intent,
  stream,
  recordingState,
  elapsed,
  onStart,
  onFinish,
  onCancel,
  onRequestPermission,
  permissionState,
  isSilent = false,
}: RecordingTakeoverProps) {
  const reducedMotion = useReducedMotion();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const intentTheme = intent ? getIntentTheme(intent) : null;
  const intentColor = intentTheme?.primary || "#7C3AED";

  // Lock body scroll when takeover is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Show permission modal when needed
  useEffect(() => {
    if (permissionState === "prompt" || permissionState === "denied") {
      setShowPermissionModal(true);
    } else {
      setShowPermissionModal(false);
    }
  }, [permissionState]);

  if (!isOpen || !prompt) return null;

  const prefersReducedMotion = reducedMotion || false;

  return (
    <>
      <MicPermissionModal
        isOpen={showPermissionModal}
        permissionState={permissionState}
        onRequestPermission={onRequestPermission}
        onClose={() => setShowPermissionModal(false)}
      />

      <div
        className="fixed inset-0 z-50"
        aria-modal="true"
        role="dialog"
        aria-labelledby="takeover-prompt-title"
      >
        {/* Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          className="absolute inset-0 bg-white/75 backdrop-blur-sm"
        />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-center">
          {/* Scenario Context Bar (top) */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.3,
              delay: prefersReducedMotion ? 0 : 0.36,
            }}
            className="px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4"
          >
            {scenario && intent && (
              <p className="text-center text-sm sm:text-base md:text-lg text-[color:rgba(11,11,12,0.80)] leading-relaxed font-medium tracking-[-0.01em] max-w-2xl mx-auto px-2">
                Let&apos;s help you sound more{" "}
                <span
                  className="font-semibold"
                  style={{ color: intentColor }}
                >
                  {intentTheme?.label || intent}
                </span>{" "}
                for your <span className="font-semibold">{scenario}</span>.
              </p>
            )}
          </motion.div>

          {/* Selected Prompt Card (centered, expanded) */}
          <div className="flex justify-center px-4 sm:px-6 pb-8 sm:pb-10 md:pb-12">
            <motion.div
              layoutId={`prompt-card-${prompt.id}`}
              layout
              initial={false}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.4,
                ease: [0.22, 1, 0.36, 1],
                layout: {
                  duration: prefersReducedMotion ? 0 : 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }
              }}
              className="w-full max-w-[720px] md:max-w-[720px] rounded-xl sm:rounded-2xl md:rounded-[24px] lg:rounded-[32px] border-2 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 bg-white"
              style={{
                borderColor: intentColor,
                backgroundColor: intentTheme?.bgTint || "rgba(255, 255, 255, 0.95)",
                boxShadow: `0 8px 32px ${intentColor}20, 0 4px 16px rgba(11,11,12,0.08)`,
              }}
            >
              {/* Category badge */}
              {prompt.category && (
                <div className="mb-2 sm:mb-3 md:mb-4">
                  <span className="inline-flex items-center text-[9px] sm:text-[10px] font-medium tracking-[0.08em] text-[color:rgba(11,11,12,0.50)] uppercase">
                    {prompt.category}
                  </span>
                </div>
              )}

              {/* Prompt title */}
              <h2
                id="takeover-prompt-title"
                className="text-lg sm:text-xl md:text-[1.5rem] lg:text-[1.75rem] xl:text-[2rem] leading-[1.3] tracking-[-0.02em] text-[color:var(--ink)] font-semibold"
              >
                {prompt.title}
              </h2>

              {/* Subtitle if available */}
              {prompt.subtitle && (
                <p className="mt-2 sm:mt-3 md:mt-4 text-sm sm:text-base md:text-lg text-[color:rgba(11,11,12,0.75)] leading-relaxed">
                  {prompt.subtitle}
                </p>
              )}
            </motion.div>
          </div>

          {/* Controls Tray (bottom) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              delay: prefersReducedMotion ? 0 : 0.36,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="px-4 sm:px-6 pb-4 sm:pb-6 md:pb-8"
          >
            <RecordingControls
              state={recordingState}
              elapsed={elapsed}
              stream={stream}
              intentColor={intentColor}
              onStart={onStart}
              onFinish={onFinish}
              onCancel={onCancel}
              isSilent={isSilent}
            />
          </motion.div>
        </div>
      </div>
    </>
  );
}

