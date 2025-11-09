"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";
import { getIntentTheme, hexToRgba } from "../lib/intentTheme";
import type { Intent } from "./ScenarioInput";

type Prompt = { 
  id: string; 
  title: string; 
  subtitle?: string | undefined; 
  category?: string | undefined; 
  icon?: string | undefined;
};

interface PromptBoardProps {
  prompts: Prompt[];
  selectedPromptId: string | null;
  intent: Intent | null;
  scenario?: string | null;
  onSelectPrompt: (prompt: Prompt) => void;
  onPracticePrompt: (prompt: Prompt) => void;
  onFreestylePractice: () => void;
  isRecording?: boolean;
  isPreparing?: boolean;
  onStartPractice?: () => void;
}

export default function PromptBoard({
  prompts,
  selectedPromptId,
  intent,
  scenario,
  onSelectPrompt,
  onPracticePrompt,
  onFreestylePractice,
  isRecording = false,
  isPreparing = false,
  onStartPractice,
}: PromptBoardProps) {
  const intentTheme = intent ? getIntentTheme(intent) : null;
  const isFreestyleSelected = selectedPromptId === 'freestyle';
  const isExpanded = isPreparing || isRecording;

  const handlePromptClick = (prompt: Prompt) => {
    onSelectPrompt(prompt);
    posthog.capture('prompt_selected', {
      prompt_id: prompt.id,
      prompt_title: prompt.title,
      prompt_category: prompt.category,
    });
  };

  const handlePracticeClick = (prompt: Prompt) => {
    onPracticePrompt(prompt);
  };

  const handleFreestyleSelect = () => {
    onSelectPrompt({ id: 'freestyle', title: scenario || 'Freestyle practice' } as Prompt);
    posthog.capture('freestyle_selected');
  };

  const handleFreestylePractice = () => {
    posthog.capture('freestyle_practice_started', {
      scenario: scenario,
    });
    onFreestylePractice();
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-8">
      {/* Prompt Cards Grid */}
      <div className={`flex flex-col gap-6 items-center md:items-stretch ${
        isExpanded && selectedPromptId && !isFreestyleSelected ? 'md:flex-row' : 'md:grid md:grid-cols-3'
      }`}>
        <AnimatePresence mode="popLayout">
          {prompts.map((prompt, index) => {
            const isSelected = selectedPromptId === prompt.id;
            const shouldShow = !isExpanded || isSelected;
            const theme = intentTheme;
            const primaryColor = theme?.primary || "#7C3AED";
            const bgTint = theme?.bgTint || "rgba(124, 58, 237, 0.05)";

            if (isExpanded && !isSelected) {
              return null;
            }

            return (
              <motion.div
                key={prompt.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ 
                  opacity: 1,
                  y: 0,
                  borderWidth: isSelected ? 3 : 2,
                  backgroundColor: isSelected ? bgTint : "#ffffff",
                }}
                exit={{ 
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                }}
                transition={{ 
                  layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.4 },
                  delay: isExpanded ? 0 : index * 0.08,
                  ease: [0.22, 1, 0.36, 1]
                }}
                whileHover={!isSelected && !isRecording && !isPreparing ? { 
                  y: -2,
                  transition: {
                    duration: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }
                } : {}}
                className={`relative rounded-[32px] border-2 text-[color:var(--ink)] p-8 sm:p-10 ${
                  isExpanded && isSelected ? 'w-full' : 'w-[85%] md:w-full'
                } flex flex-col h-[240px] cursor-pointer ${
                  isSelected
                    ? ""
                    : "border-[color:var(--muted-2)]"
                }`}
              style={
                isSelected
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: bgTint,
                      boxShadow: `0 8px 32px ${primaryColor}20, 0 4px 16px rgba(11,11,12,0.08)`,
                    }
                  : {
                      boxShadow: "0 4px 20px rgba(11,11,12,0.06), 0 2px 8px rgba(11,11,12,0.04)",
                    }
              }
              onClick={() => {
                if (!isRecording && !isPreparing) {
                  handlePromptClick(prompt);
                }
              }}
              style={
                isSelected
                  ? {
                      borderColor: primaryColor,
                      backgroundColor: bgTint,
                      boxShadow: `0 8px 32px ${primaryColor}20, 0 4px 16px rgba(11,11,12,0.08)`,
                    }
                  : {}
              }
            >
              {/* Selected indicator - checkmark */}
              {isSelected && (
                <div className="absolute top-6 right-6">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: primaryColor,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Main content - flex grow to push button down */}
              <div className="flex-1 flex flex-col">
                {/* Category badge - subtle, minimal */}
                {prompt.category && (
                  <div className="mb-3">
                    <span className="inline-flex items-center text-[9px] font-medium tracking-[0.05em] text-[color:rgba(11,11,12,0.45)] uppercase">
                      {prompt.category}
                    </span>
                  </div>
                )}

                {/* Prompt title - refined, elegant */}
                <h3 className="text-[1.125rem] sm:text-[1.25rem] leading-[1.35] tracking-[-0.015em] text-[color:var(--ink)] font-medium flex-1">
                  {prompt.title}
                </h3>
              </div>

            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Freestyle Card - Premium Design */}
      <AnimatePresence>
        {(!isExpanded || isFreestyleSelected) && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ 
              opacity: 1,
              y: 0,
              borderWidth: isFreestyleSelected ? 3 : 2,
              backgroundColor: isFreestyleSelected && intentTheme ? intentTheme.bgTint : "rgba(255, 255, 255, 0.8)",
            }}
            exit={{ 
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
            }}
            transition={{ 
              layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.4 },
              delay: isExpanded ? 0 : 0.16, 
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={!isFreestyleSelected && !isRecording && !isPreparing ? { 
              y: -2,
              transition: {
                duration: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }
            } : {}}
            onClick={() => {
              if (!isRecording && !isPreparing) {
                handleFreestyleSelect();
              }
            }}
            className={`relative rounded-[32px] border-2 text-[color:var(--ink)] p-5 sm:p-6 ${
              isExpanded && isFreestyleSelected ? 'w-full' : 'w-[85%] md:w-full'
            } mx-auto md:mx-0 flex flex-col h-[110px] cursor-pointer ${
          isFreestyleSelected
            ? ""
            : "border-[color:var(--muted-2)]/60"
        }`}
        style={
          isFreestyleSelected && intentTheme
            ? {
                borderColor: intentTheme.primary,
                backgroundColor: intentTheme.bgTint,
                boxShadow: `0 8px 32px ${intentTheme.primary}20, 0 4px 16px rgba(11,11,12,0.08)`,
              }
            : {
                boxShadow: "0 4px 20px rgba(11,11,12,0.06), 0 2px 8px rgba(11,11,12,0.04)",
              }
        }
      >
        {/* Selected indicator - checkmark */}
        {isFreestyleSelected && intentTheme && (
          <div className="absolute top-5 right-5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: intentTheme.primary,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
        )}

        {/* Compact header */}
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[color:var(--muted-1)] to-[color:var(--muted-2)] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[color:rgba(11,11,12,0.60)]"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <path d="M8 22h8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[0.9375rem] sm:text-[1rem] leading-[1.3] tracking-[-0.01em] text-[color:var(--ink)] font-medium">
              Or practice freely
            </h3>
            {scenario && (
              <p className="text-[0.8125rem] sm:text-[0.875rem] leading-[1.4] text-[color:rgba(11,11,12,0.70)] italic truncate mt-1">
                "{scenario}"
              </p>
            )}
          </div>
        </div>

      </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

