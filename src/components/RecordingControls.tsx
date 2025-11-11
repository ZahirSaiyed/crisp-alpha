"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LiveWaveform from "./LiveWaveform";

type RecordingState = "idle" | "arming" | "recording";

interface RecordingControlsProps {
  state: RecordingState;
  elapsed: number;
  stream: MediaStream | null;
  intentColor?: string;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  isSilent?: boolean;
}

const COPY: Record<RecordingState, { label: string; ariaLabel: string }> = {
  idle: {
    label: "Start recording",
    ariaLabel: "Start recording",
  },
  arming: {
    label: "Listening…",
    ariaLabel: "Listening, preparing to record",
  },
  recording: {
    label: "Finish",
    ariaLabel: "Finish recording",
  },
};

export default function RecordingControls({
  state,
  elapsed,
  stream,
  intentColor = "#7C3AED",
  onStart,
  onFinish,
  onCancel,
  isSilent = false,
}: RecordingControlsProps) {
  const recordButtonRef = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  // Focus management on mount
  useEffect(() => {
    if (state === "idle" && recordButtonRef.current) {
      recordButtonRef.current.focus();
    }
  }, [state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (state === "recording") {
            onFinish();
          } else if (state === "idle") {
            onStart();
          }
          break;
        case "Escape":
          e.preventDefault();
          onCancel();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, onFinish, onStart, onCancel]);

  // Haptics
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(15);
    }
  };

  const handleStart = () => {
    triggerHaptic();
    onStart();
    setAnnouncement("Recording started");
  };

  const handleFinish = () => {
    triggerHaptic();
    onFinish();
    setAnnouncement("Recording finished");
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isRecording = state === "recording";
  const showTimer = isRecording;
  const showWaveform = isRecording;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 md:gap-5">
      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Timer */}
      <AnimatePresence>
        {showTimer && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ 
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
            role="status"
            aria-live="polite"
            className="text-3xl sm:text-4xl font-mono font-semibold text-[color:var(--ink)] tracking-tight"
          >
            {formatTime(elapsed)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform */}
      <AnimatePresence>
        {showWaveform && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ 
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            <LiveWaveform
              stream={stream}
              isRecording={isRecording}
              isPaused={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Silence alert */}
      {isSilent && isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-amber-600 text-center max-w-xs font-medium"
        >
          We&apos;re not picking up audio. Check your mic or speak closer.
        </motion.div>
      )}

      {/* Main controls */}
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        {/* Primary record button */}
        <motion.button
          ref={recordButtonRef}
          onClick={() => {
            if (state === "idle") {
              handleStart();
            } else if (state === "arming") {
              // Do nothing during arming
            } else if (state === "recording") {
              handleFinish();
            }
          }}
          disabled={state === "arming"}
          whileHover={state !== "arming" ? { scale: 1.05 } : {}}
          whileTap={state !== "arming" ? { scale: 0.95 } : {}}
          animate={{
            scale: state === "recording" ? [1, 1.02, 1] : 1,
          }}
          transition={{
            scale: {
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }
          }}
          className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-[#E5484D] hover:bg-[#D7373F]"
          style={{
            ['--focus-outline-color' as string]: intentColor,
          }}
          aria-label={COPY[state].ariaLabel}
        >
          <AnimatePresence mode="wait">
            {state === "idle" ? (
              <motion.svg
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="white" strokeWidth="1.5"></rect>
                <path d="M5 10V11C5 14.866 8.13401 18 12 18V18V18C15.866 18 19 14.866 19 11V10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                <path d="M12 18V22M12 22H9M12 22H15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
              </motion.svg>
            ) : state === "arming" ? (
              <motion.div
                key="arming"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: [1, 1.2, 1] }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.5, repeat: Infinity }
                }}
                className="w-6 h-6 bg-white rounded-full"
              />
            ) : (
              <motion.svg
                key="recording"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="white"
                stroke="white"
                strokeWidth="2"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ 
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="text-base font-medium text-[color:rgba(11,11,12,0.80)] tracking-[-0.01em]"
          >
            {COPY[state].label}
          </motion.div>
        </AnimatePresence>

        {/* Secondary actions */}
        <AnimatePresence>
          {state === "idle" && (
            <motion.button
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ 
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1]
              }}
              onClick={onCancel}
              className="text-sm font-medium text-[color:rgba(11,11,12,0.70)] hover:text-[color:var(--ink)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded px-3 py-1.5 tracking-[-0.01em]"
              style={{
                ['--focus-outline-color' as string]: intentColor,
              }}
            >
              Cancel
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

