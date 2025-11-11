"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";
import { getIntentTheme } from "../lib/intentTheme";
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
}

export default function PromptBoard({
  prompts,
  selectedPromptId,
  intent,
  scenario,
  onSelectPrompt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPracticePrompt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFreestylePractice,
  isRecording = false,
  isPreparing = false,
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

  const handleFreestyleSelect = () => {
    onSelectPrompt({ id: 'freestyle', title: scenario || 'Freestyle practice' } as Prompt);
    posthog.capture('freestyle_selected');
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-4 sm:space-y-8">
      {/* Prompt Cards Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 ${
        isExpanded && selectedPromptId && !isFreestyleSelected ? 'md:flex md:flex-row' : ''
      }`}>
        <AnimatePresence mode="sync">
          {prompts.map((prompt) => {
            const isSelected = selectedPromptId === prompt.id;
            const theme = intentTheme;
            const primaryColor = theme?.primary || "#7C3AED";
            const bgTint = theme?.bgTint || "rgba(124, 58, 237, 0.05)";

            if (isExpanded && !isSelected) {
              return null;
            }

            return (
              <motion.div
                key={prompt.id}
                {...(isExpanded ? { layoutId: `prompt-card-${prompt.id}` } : {})}
                layout={isExpanded}
                initial={false}
                animate={{ 
                  opacity: 1,
                  y: 0,
                  borderWidth: isSelected ? 3 : 2,
                  backgroundColor: isSelected ? bgTint : "#ffffff",
                }}
                exit={{ 
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
                }}
                transition={{ 
                  layout: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0 },
                  borderWidth: { duration: 0 },
                  backgroundColor: { duration: 0 },
                  y: { duration: 0.2 },
                  ease: [0.22, 1, 0.36, 1]
                }}
                whileHover={!isSelected && !isRecording && !isPreparing ? { 
                  y: -2,
                  transition: {
                    duration: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }
                } : {}}
                className={`relative rounded-xl sm:rounded-2xl md:rounded-[32px] border-2 text-[color:var(--ink)] p-4 sm:p-6 md:p-8 lg:p-10 ${
                  isExpanded && isSelected ? 'w-full' : 'w-full'
                } flex flex-col h-auto min-h-[120px] sm:min-h-[160px] md:min-h-[200px] lg:h-[240px] cursor-pointer ${
                  isSelected
                    ? ""
                    : "border-[color:var(--muted-2)]"
                }`}
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
                  : {
                      boxShadow: "0 4px 20px rgba(11,11,12,0.06), 0 2px 8px rgba(11,11,12,0.04)",
                    }
              }
            >
              {/* Selected indicator - checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6">
                  <div
                    className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: primaryColor,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      className="sm:w-3 sm:h-3 md:w-[14px] md:h-[14px]"
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
                  <div className="mb-2 sm:mb-3">
                    <span className="inline-flex items-center text-[8px] sm:text-[9px] font-medium tracking-[0.05em] text-[color:rgba(11,11,12,0.45)] uppercase">
                      {prompt.category}
                    </span>
                  </div>
                )}

                {/* Prompt title - refined, elegant */}
                <h3 className="text-sm sm:text-base md:text-[1.125rem] lg:text-[1.25rem] leading-[1.35] tracking-[-0.015em] text-[color:var(--ink)] font-medium flex-1">
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
            initial={false}
            animate={{ 
              opacity: 1,
              y: 0,
              borderWidth: isFreestyleSelected ? 3 : 2,
              backgroundColor: isFreestyleSelected && intentTheme ? intentTheme.bgTint : "rgba(255, 255, 255, 0.8)",
            }}
            exit={{ 
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
            }}
            transition={{ 
              layout: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0 },
              borderWidth: { duration: 0 },
              backgroundColor: { duration: 0 },
              y: { duration: 0.2 },
              ease: [0.22, 1, 0.36, 1]
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
            className={`relative rounded-xl sm:rounded-2xl md:rounded-[32px] border-2 text-[color:var(--ink)] p-3 sm:p-4 md:p-5 lg:p-6 ${
              isExpanded && isFreestyleSelected ? 'w-full' : 'w-full'
            } flex flex-col h-auto min-h-[90px] sm:min-h-[100px] md:h-[110px] cursor-pointer ${
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
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-5 md:right-5">
            <div
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: intentTheme.primary,
              }}
            >
              <svg
                width="12"
                height="12"
                className="sm:w-3 sm:h-3 md:w-[14px] md:h-[14px]"
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
        <div className="flex items-start gap-2 sm:gap-2.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-br from-[color:var(--muted-1)] to-[color:var(--muted-2)] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg
              width="12"
              height="12"
              className="sm:w-3 sm:h-3 md:w-[14px] md:h-[14px] text-[color:rgba(11,11,12,0.60)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <path d="M8 22h8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-sm md:text-[0.9375rem] lg:text-[1rem] leading-[1.3] tracking-[-0.01em] text-[color:var(--ink)] font-medium">
              Or practice freely
            </h3>
            {scenario && (
              <p className="text-[10px] sm:text-xs md:text-[0.8125rem] lg:text-[0.875rem] leading-[1.4] text-[color:rgba(11,11,12,0.70)] italic truncate mt-0.5 sm:mt-1">
                &quot;{scenario}&quot;
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

