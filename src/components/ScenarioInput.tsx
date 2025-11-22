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
    <div className="w-full space-y-6">
      {/* Main scenario input */}
      <div className="relative group">
        <div className={`absolute inset-0 bg-gradient-to-r from-[var(--intent-persuasive)] to-[var(--intent-natural)] rounded-2xl opacity-0 transition-opacity duration-300 ${isFocused ? 'opacity-10' : 'group-hover:opacity-5'}`} />

        <div className="relative">
          <input
            id="scenario-input"
            type="text"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value);
              hasTrackedConfigured.current = false; // Reset tracking on change
            }}
            onFocus={() => {
              setIsFocused(true);
              setIsTyping(false);
              setDisplayText("");
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            placeholder=""
            className="w-full px-6 py-5 rounded-2xl border-2 bg-white text-[var(--ink)] text-lg sm:text-xl font-medium focus:outline-none transition-all duration-200 shadow-sm placeholder:text-[var(--muted-2)]"
            style={{
              borderColor: selectedIntent && scenario.trim().length > 0
                ? getIntentTheme(selectedIntent)?.primary || "#7C3AED"
                : isFocused ? "var(--ink)" : "var(--muted-2)",
              boxShadow: selectedIntent && scenario.trim().length > 0
                ? `0 0 0 4px ${getIntentTheme(selectedIntent)?.bgTint || "rgba(124, 58, 237, 0.05)"}`
                : isFocused ? "0 4px 20px rgba(0,0,0,0.05)" : "none"
            }}
            disabled={isLoading}
            aria-label="What moment are you preparing for?"
          />

          {/* Typing animation overlay */}
          {!isFocused && !scenario && isTyping && (
            <div className="absolute inset-0 px-6 py-5 flex items-center pointer-events-none">
              <span className="text-lg sm:text-xl font-medium text-[var(--ink-light)] opacity-40 leading-normal">
                {displayText}
                <span className="inline-block w-0.5 h-6 bg-[var(--intent-persuasive)] ml-1.5 animate-pulse align-middle" style={{ marginTop: '-2px' }} />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Intent selector - animates in after typing */}
      <AnimatePresence>
        {showIntents && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-4">
              <p className="text-center text-sm font-semibold text-[var(--ink-light)] uppercase tracking-wide">
                How do you want to sound?
              </p>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
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
                      className={`p-4 rounded-xl text-left transition-all duration-200 border-2 relative overflow-hidden group ${isSelected
                          ? "border-transparent shadow-lg scale-[1.02]"
                          : "border-[var(--muted-2)] bg-white hover:border-[var(--ink-light)]"
                        }`}
                      style={isSelected ? { backgroundColor: primaryColor } : {}}
                    >
                      <div className="relative z-10 flex flex-col gap-1">
                        <span className={`font-bold text-base ${isSelected ? "text-white" : "text-[var(--ink)]"}`}>
                          {intent.label}
                        </span>
                        <span className={`text-xs ${isSelected ? "text-white/90" : "text-[var(--ink-light)]"}`}>
                          {intent.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate button */}
      <AnimatePresence>
        {selectedIntent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-center pt-4"
          >
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isLoading}
              className={`px-10 py-4 rounded-full text-lg font-bold transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 ${canGenerate && !isLoading
                  ? "bg-[var(--ink)] text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
            >
              {isLoading ? "Preparing..." : "Start Training"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

