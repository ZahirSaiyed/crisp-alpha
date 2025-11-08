"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: { id: string; title: string; subtitle?: string };
  onContinue: () => void;
}

export default function PracticeModal({ isOpen, onClose, prompt, onContinue }: PracticeModalProps) {
  const [practiceText, setPracticeText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const handlePractice = () => {
    if (practiceText.trim() || isRecording) {
      setHasCompleted(true);
      posthog.capture("mini_practice_completed", {
        prompt_id: prompt.id,
        has_text: practiceText.trim().length > 0,
        is_recording: isRecording,
      });
    }
  };

  const handleContinue = () => {
    posthog.capture("practice_modal_continue_clicked", {
      prompt_id: prompt.id,
    });
    onContinue();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[color:var(--muted-1)] transition-colors duration-200"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-2">{prompt.title}</h2>
              {prompt.subtitle && (
                <p className="text-sm text-[color:rgba(11,11,12,0.6)]">{prompt.subtitle}</p>
              )}
            </div>

            {!hasCompleted ? (
              <>
                {/* Practice input */}
                <div className="space-y-4">
                  <textarea
                    value={practiceText}
                    onChange={(e) => setPracticeText(e.target.value)}
                    placeholder="Type your response here, or use voice input..."
                    className="w-full px-4 py-3 rounded-xl border border-[color:var(--muted-2)] bg-white text-[color:var(--ink)] text-base min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[color:var(--intent-persuasive)] focus:border-transparent transition-all duration-200 resize-none"
                    disabled={isRecording}
                  />

                  {/* Voice input button */}
                  <button
                    onClick={() => {
                      setIsRecording(!isRecording);
                      if (!isRecording) {
                        posthog.capture("mini_practice_started", {
                          prompt_id: prompt.id,
                          method: "voice",
                        });
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
                      isRecording
                        ? "bg-red-500 text-white"
                        : "bg-[color:var(--muted-1)] text-[color:var(--ink)] hover:bg-[color:var(--muted-2)]"
                    }`}
                  >
                    {isRecording ? "● Stop Recording" : "🎤 Start Voice Input"}
                  </button>

                  {/* Practice button */}
                  <button
                    onClick={handlePractice}
                    disabled={!practiceText.trim() && !isRecording}
                    className={`w-full px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
                      practiceText.trim() || isRecording
                        ? "bg-[color:var(--intent-persuasive)] text-white shadow-[0_4px_12px_rgba(124,58,237,0.25)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.35)]"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Practice
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Sample feedback */}
                <div className="p-4 rounded-xl bg-[color:var(--muted-1)] space-y-2">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">Sample feedback:</p>
                  <p className="text-sm text-[color:rgba(11,11,12,0.7)]">
                    Your response shows clarity and confidence. Keep practicing to refine your delivery.
                  </p>
                </div>

                {/* Continue button */}
                <button
                  onClick={handleContinue}
                  className="w-full px-6 py-3 rounded-full font-semibold bg-[color:var(--intent-persuasive)] text-white shadow-[0_4px_12px_rgba(124,58,237,0.25)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.35)] transition-all duration-200"
                >
                  Continue in Crisp →
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

