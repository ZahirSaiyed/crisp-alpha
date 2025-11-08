"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

export type Intent = "decisive" | "natural" | "calm";

export interface ScenarioInputProps {
  onGenerate: (scenario: string, intent: Intent) => void;
  isLoading?: boolean;
}

const QUICK_CHIPS = [
  { label: "Interview", value: "interview" },
  { label: "Meeting", value: "meeting" },
  { label: "Presentation", value: "presentation" },
  { label: "Difficult Talk", value: "difficult-talk" },
  { label: "Fun", value: "fun" },
];

const INTENTS: Array<{ value: Intent; label: string; description: string }> = [
  { value: "decisive", label: "Decisive", description: "Clear and confident" },
  { value: "natural", label: "Natural", description: "Conversational and authentic" },
  { value: "calm", label: "Calm", description: "Composed and steady" },
];

export default function ScenarioInput({ onGenerate, isLoading = false }: ScenarioInputProps) {
  const [scenario, setScenario] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);
  const [showIntents, setShowIntents] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedConfigured = useRef(false);

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

  const handleChipClick = useCallback((value: string) => {
    const chipText = QUICK_CHIPS.find((c) => c.value === value)?.label || value;
    setScenario(chipText);
    setShowIntents(true);
  }, []);

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
    <div className="w-full max-w-[640px] mx-auto space-y-6">
      {/* Main scenario input */}
      <div className="space-y-3">
        <label htmlFor="scenario-input" className="block text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[color:var(--ink)] mb-2">
            What moment are you preparing for?
          </h2>
          <p className="text-sm text-[color:rgba(11,11,12,0.6)]">
            Type your scenario or choose a quick option below
          </p>
        </label>
        <input
          id="scenario-input"
          type="text"
          value={scenario}
          onChange={(e) => {
            setScenario(e.target.value);
            hasTrackedConfigured.current = false; // Reset tracking on change
          }}
          placeholder="e.g., Microsoft interview, tough talk with my boss..."
          className="w-full px-4 py-3 sm:py-4 rounded-xl border border-[color:var(--muted-2)] bg-white text-[color:var(--ink)] text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--bright-purple)] focus:border-transparent transition-all"
          disabled={isLoading}
          aria-label="What moment are you preparing for?"
        />
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => handleChipClick(chip.value)}
            disabled={isLoading}
            className="px-3 sm:px-4 py-2 rounded-full text-sm font-medium bg-white border border-[color:var(--muted-2)] text-[color:rgba(11,11,12,0.8)] hover:border-[color:var(--bright-purple)]/30 hover:shadow-[0_2px_8px_rgba(122,92,255,0.1)] transition-all duration-200 transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--bright-purple)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Quick select: ${chip.label}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Intent selector - animates in after typing */}
      <AnimatePresence>
        {showIntents && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <p className="text-center text-sm font-medium text-[color:rgba(11,11,12,0.7)]">
              How do you want to sound?
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {INTENTS.map((intent) => {
                const isSelected = selectedIntent === intent.value;
                return (
                  <button
                    key={intent.value}
                    type="button"
                    onClick={() => handleIntentSelect(intent.value)}
                    disabled={isLoading}
                    aria-pressed={isSelected}
                    className={`px-4 sm:px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all duration-200 transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-[color:var(--bright-purple)] text-white shadow-[0_4px_12px_rgba(122,92,255,0.25)] scale-105"
                        : "bg-white border-2 border-[color:var(--muted-2)] text-[color:rgba(11,11,12,0.8)] hover:border-[color:var(--bright-purple)]/50 hover:shadow-[0_2px_8px_rgba(122,92,255,0.1)] hover:scale-105"
                    }`}
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
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold transition-all duration-200 transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            canGenerate
              ? "bg-[color:var(--bright-purple)] text-white shadow-[0_4px_12px_rgba(122,92,255,0.25)] hover:shadow-[0_6px_20px_rgba(122,92,255,0.35)] hover:scale-105"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          aria-label="Generate prompts"
        >
          {isLoading ? "Generating..." : "Generate Prompts"}
        </button>
      </div>
    </div>
  );
}

