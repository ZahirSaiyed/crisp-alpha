"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import ScenarioInput, { type Intent } from "../components/ScenarioInput";
import PhilosophyBlock from "../components/PhilosophyBlock";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const interactionStartTime = useRef<number | null>(null);

  useEffect(() => {
    posthog.capture("viewed_landing_page");
    interactionStartTime.current = Date.now();
  }, []);

  const handleGenerate = async (scenarioText: string, selectedIntent: Intent) => {
    setIsLoading(true);

    // Track time to first interaction
    if (interactionStartTime.current) {
      const timeToInteraction = Date.now() - interactionStartTime.current;
      posthog.capture("time_to_first_interaction", {
        time_ms: timeToInteraction,
        under_15s: timeToInteraction < 15000,
      });
    }

    posthog.capture("hero_scenario_input_started", {
      scenario_length: scenarioText.length,
      intent: selectedIntent,
    });

    try {
      // Generate idempotency key
      const text = `${scenarioText}:${selectedIntent}`;
      const encoder = new TextEncoder();
      const encodedText = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encodedText);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const idempotencyKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Generate prompts first
      const response = await fetch('/api/prompts/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioText,
          intent: selectedIntent,
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate prompts: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data.prompts) && data.data.prompts.length > 0) {
        // Store prompts in sessionStorage for record page
        sessionStorage.setItem('crisp_generated_prompts', JSON.stringify(data.data.prompts));
        sessionStorage.setItem('crisp_prompt_source', data.data.source || 'unknown');
        
        posthog.capture('prompt_generation_success', {
          source: data.data.source,
          scenario_length: scenarioText.length,
          intent: selectedIntent,
        });

        // Redirect to record page with scenario and intent as query params
        const params = new URLSearchParams({
          scenario: scenarioText,
          intent: selectedIntent,
        });
        
        router.push(`/record?${params.toString()}`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Failed to generate prompts:', error);
      posthog.capture('prompt_generation_failed', {
        scenario_length: scenarioText.length,
        intent: selectedIntent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Still redirect - record page will handle fallback
      const params = new URLSearchParams({
        scenario: scenarioText,
        intent: selectedIntent,
      });
      router.push(`/record?${params.toString()}`);
    }
  };

  return (
    <main className="min-h-screen text-[color:var(--ink)]">
      {/* Hero / Scenario Input Section */}
      <section className="relative pt-4 sm:pt-8 md:pt-16 pb-6 sm:pb-8 md:pb-12 min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh] flex items-center">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--intent-persuasive)]/3 via-transparent to-[color:var(--intent-natural)]/2 opacity-40" />
        
        {/* Subtle divider line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:var(--muted-2)] to-transparent opacity-30" />
        
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-5 md:px-6 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <ScenarioInput onGenerate={handleGenerate} isLoading={isLoading} />
          </motion.div>
        </div>
      </section>

      {/* Philosophy Block */}
      <PhilosophyBlock />

      {/* Footer */}
      <footer className="border-t border-[color:var(--muted-2)] py-10 sm:py-14 md:py-16 lg:py-20 bg-gradient-to-b from-white to-[#FAFAF8]">
        <div className="mx-auto max-w-4xl px-4 sm:px-5 md:px-6">
          <div className="text-center space-y-5 sm:space-y-6 md:space-y-8">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-[color:var(--ink)] leading-tight px-2" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
              Human clarity in an AI world.
            </h3>
            
            {/* Trust statement */}
            <p className="text-sm sm:text-base md:text-lg text-[color:rgba(11,11,12,0.7)] max-w-2xl mx-auto leading-relaxed font-medium px-2">
              Crisp is private, local-first, and built for humans — not algorithms.
            </p>
            
            {/* Email capture */}
            <div className="max-w-md mx-auto pt-2 sm:pt-4 px-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const email = formData.get("email") as string;
                  if (email) {
                    posthog.capture("email_capture", { email });
                    // TODO: Add to waitlist/email service
                    alert("Thanks! We'll be in touch soon.");
                    e.currentTarget.reset();
                  }
                }}
                className="flex flex-col sm:flex-row gap-2 sm:gap-2"
              >
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl border border-[color:var(--muted-2)] bg-white text-[color:var(--ink)] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[color:var(--intent-persuasive)]/30 focus:border-[color:var(--intent-persuasive)] transition-all duration-200"
                />
                <button
                  type="submit"
                  className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium bg-[#0B0B0C] text-white hover:bg-[#1a1a1b] transition-all duration-200 whitespace-nowrap"
                >
                  Join waitlist
                </button>
              </form>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
