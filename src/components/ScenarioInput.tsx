"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";
import { getIntentTheme } from "../lib/intentTheme";

export type Intent = "decisive" | "natural" | "calm";

export interface ScenarioInputProps {
  onGenerate: (scenario: string, intent: Intent) => void;
  isLoading?: boolean;
}

const INTENTS: Array<{ value: Intent; label: string; description: string }> = [
  { value: "decisive", label: "Decisive", description: "Clear and confident" },
  { value: "natural", label: "Natural", description: "Conversational and authentic" },
  { value: "calm", label: "Calm", description: "Composed and steady" },
];

const TYPING_EXAMPLES = [
  "pitching my startup to investors next week",
  "difficult conversation with my manager about my workload",
  "presenting quarterly results to the board",
  "asking for a raise after my promotion",
  "explaining a mistake I made to my team",
  "first day leading a new project",
  "networking event where I need to introduce myself confidently",
  "client meeting where I need to say no gracefully",
  "giving feedback to a colleague who's struggling",
  "negotiating my salary for a new role",
];

export default function ScenarioInput({ onGenerate, isLoading = false }: ScenarioInputProps) {
  const [scenario, setScenario] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [showIntents, setShowIntents] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedConfigured = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentExampleIndexRef = useRef(0);
  const currentCharIndexRef = useRef(0);
  const isDeletingRef = useRef(false);

  // Typing animation effect - only when not focused and input is empty
  useEffect(() => {
    // Stop animation immediately when focused or has content
    if (isFocused || scenario.trim().length > 0 || isLoading) {
      setIsTyping(false);
      setDisplayText("");
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    // Start animation when unfocused and empty
    setIsTyping(true);
    
    const type = () => {
      // Check again if we should stop
      if (isFocused || scenario.trim().length > 0 || isLoading) {
        setIsTyping(false);
        setDisplayText("");
        return;
      }

      // Get current example from ref (so it updates when we change examples)
      const currentExample = TYPING_EXAMPLES[currentExampleIndexRef.current];
      
      if (!currentExample) {
        // Safety check - reset if example is invalid
        currentExampleIndexRef.current = 0;
        return;
      }

      if (isDeletingRef.current) {
        // Deleting
        if (currentCharIndexRef.current > 0) {
          currentCharIndexRef.current--;
          setDisplayText(currentExample.substring(0, currentCharIndexRef.current));
          typingTimeoutRef.current = setTimeout(type, 50);
        } else {
          // Move to random next example (avoid same one)
          isDeletingRef.current = false;
          let nextIndex;
          do {
            nextIndex = Math.floor(Math.random() * TYPING_EXAMPLES.length);
          } while (nextIndex === currentExampleIndexRef.current && TYPING_EXAMPLES.length > 1);
          currentExampleIndexRef.current = nextIndex;
          typingTimeoutRef.current = setTimeout(type, 500);
        }
      } else {
        // Typing
        if (currentCharIndexRef.current < currentExample.length) {
          currentCharIndexRef.current++;
          setDisplayText(currentExample.substring(0, currentCharIndexRef.current));
          typingTimeoutRef.current = setTimeout(type, 80);
        } else {
          // Pause before deleting
          isDeletingRef.current = true;
          typingTimeoutRef.current = setTimeout(type, 2000);
        }
      }
    };

    // Reset and start fresh with random example
    currentExampleIndexRef.current = Math.floor(Math.random() * TYPING_EXAMPLES.length);
    currentCharIndexRef.current = 0;
    isDeletingRef.current = false;
    typingTimeoutRef.current = setTimeout(type, 1000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isFocused, scenario, isLoading]);

  // Debounce scenario input for analytics
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (scenario.trim().length > 0) {
      debounceTimerRef.current = setTimeout(() => {
        // Show intents after user starts typing
        if (!showIntents) {
          setShowIntents(true);
        }
      }, 300);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [scenario, showIntents]);

  // Track scenario_configured when both scenario and intent are set
  useEffect(() => {
    if (scenario.trim().length > 0 && selectedIntent && !hasTrackedConfigured.current) {
      posthog.capture("scenario_configured", {
        scenario_length: scenario.length,
        intent: selectedIntent,
      });
      hasTrackedConfigured.current = true;
    }
  }, [scenario, selectedIntent]);

  const handleIntentSelect = useCallback((intent: Intent) => {
    setSelectedIntent(intent);
    posthog.capture("intent_selected", { intent });
  }, []);

  const handleGenerate = useCallback(() => {
    if (!scenario.trim() || !selectedIntent) return;

    posthog.capture("scenario_submitted", {
      scenario_length: scenario.length,
      intent: selectedIntent,
    });

    onGenerate(scenario.trim(), selectedIntent);
  }, [scenario, selectedIntent, onGenerate]);

  const canGenerate = scenario.trim().length > 0 && selectedIntent !== null && !isLoading;

  return (
    <div className="w-full max-w-[640px] mx-auto space-y-6 sm:space-y-7 md:space-y-8">
      {/* Main scenario input */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <label htmlFor="scenario-input" className="block text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[color:var(--ink)] mb-3 sm:mb-4 leading-tight tracking-tight px-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
            What moment are you preparing for?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-[color:rgba(11,11,12,0.65)] font-medium leading-relaxed px-2">
            Share your scenario
          </p>
        </label>
        <div className="relative">
          <input
            id="scenario-input"
            type="text"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value);
              hasTrackedConfigured.current = false; // Reset tracking on change
            }}
            onFocus={(e) => {
              // Stop animation immediately
              setIsFocused(true);
              setIsTyping(false);
              setDisplayText("");
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              // Handle border styling
              if (selectedIntent) {
                const theme = getIntentTheme(selectedIntent);
                e.currentTarget.style.borderColor = theme?.primary || "#7C3AED";
                e.currentTarget.style.boxShadow = `0 0 0 3px ${theme?.bgTint || "rgba(124, 58, 237, 0.05)"}`;
              }
            }}
            onBlur={(e) => {
              setIsFocused(false);
              // Handle border styling
              if (selectedIntent && scenario.trim().length > 0) {
                const theme = getIntentTheme(selectedIntent);
                e.currentTarget.style.borderColor = theme?.primary || "#7C3AED";
                e.currentTarget.style.boxShadow = `0 0 0 3px ${theme?.bgTint || "rgba(124, 58, 237, 0.05)"}`;
              } else {
                e.currentTarget.style.borderColor = "var(--muted-2)";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
            placeholder=""
            className="w-full px-4 sm:px-5 py-3.5 sm:py-4 md:py-5 rounded-xl border-2 bg-white text-[color:var(--ink)] text-sm sm:text-base md:text-lg font-medium focus:outline-none transition-all duration-200 shadow-sm"
          style={
            selectedIntent && scenario.trim().length > 0
              ? {
                  borderColor: getIntentTheme(selectedIntent)?.primary || "#7C3AED",
                  boxShadow: `0 0 0 3px ${getIntentTheme(selectedIntent)?.bgTint || "rgba(124, 58, 237, 0.05)"}`,
                }
              : {
                  borderColor: "var(--muted-2)",
                }
          }
            disabled={isLoading}
            aria-label="What moment are you preparing for?"
          />
          {/* Typing animation overlay */}
          {!isFocused && !scenario && isTyping && (
            <div className="absolute inset-0 px-4 sm:px-5 py-3.5 sm:py-4 md:py-5 flex items-center pointer-events-none">
              <span className="text-sm sm:text-base md:text-lg font-medium text-[color:rgba(11,11,12,0.4)] leading-normal">
                {displayText}
                <span className="inline-block w-0.5 h-5 bg-[color:var(--intent-persuasive)] ml-1.5 animate-pulse align-middle" style={{ marginTop: '2px' }} />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Intent selector - animates in after typing */}
      <AnimatePresence>
        {showIntents && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-3 sm:space-y-4 md:space-y-5"
          >
            <p className="text-center text-sm sm:text-base md:text-lg font-semibold text-[color:var(--ink)] leading-relaxed px-2">
              How do you want to sound?
            </p>
            <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-3 md:gap-4 px-2">
              {INTENTS.map((intent) => {
                const isSelected = selectedIntent === intent.value;
                const theme = getIntentTheme(intent.value);
                const primaryColor = theme?.primary || "#7C3AED";
                return (
                  <button
                    key={intent.value}
                    type="button"
                    onClick={() => handleIntentSelect(intent.value)}
                    disabled={isLoading}
                    aria-pressed={isSelected}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                    className={`px-2 sm:px-3 md:px-5 lg:px-7 py-2 sm:py-2.5 md:py-3 lg:py-3.5 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed ${
                      isSelected
                        ? "text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                        : "bg-white border-2 border-[color:var(--muted-2)] text-[color:var(--ink)] hover:border-opacity-50 shadow-sm"
                    }`}
                    onMouseEnter={(e) => {
                      if (!isSelected && theme) {
                        e.currentTarget.style.borderColor = primaryColor;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "";
                      }
                    }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{intent.label}</span>
                      <span className={`text-xs ${isSelected ? "text-white/80" : "text-[color:rgba(11,11,12,0.6)]"}`}>
                        {intent.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate button */}
      <div className="flex justify-center pt-4 sm:pt-5 md:pt-6">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isLoading}
          className={`px-8 sm:px-10 md:px-12 py-3 sm:py-4 md:py-5 rounded-full text-base sm:text-lg md:text-xl font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 leading-tight tracking-tight ${
            canGenerate && !isLoading
              ? "bg-[color:var(--intent-persuasive)] text-white shadow-[0_6px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_28px_rgba(124,58,237,0.4)] hover:scale-105"
              : isLoading
              ? "bg-[color:var(--intent-persuasive)] text-white shadow-[0_6px_20px_rgba(124,58,237,0.3)]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          aria-label="Show me what to practice"
        >
          {isLoading ? "Preparing..." : "Show me what to practice"}
        </button>
      </div>
    </div>
  );
}

