"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { type Intent } from "../components/ScenarioInput";
import PhilosophyBlock from "../components/PhilosophyBlock";
import HeroSection from "../components/HeroSection";
import ManifestoBlock from "../components/ManifestoBlock";
import VisionBlock from "../components/VisionBlock";

import Navbar from "../components/Navbar";

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
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--intent-persuasive)] selection:text-white">
      <Navbar />
      <HeroSection onGenerate={handleGenerate} isLoading={isLoading} />
      <ManifestoBlock />
      <PhilosophyBlock />
      <VisionBlock />

      {/* Footer */}
      <footer className="border-t border-[var(--muted-2)] py-20 bg-[var(--bg-warm)]">
        <div className="mx-auto max-w-4xl px-6 text-center space-y-8">
          <h3 className="text-2xl font-bold text-[var(--ink)] display-headline">
            Human clarity in an AI world.
          </h3>

          <p className="text-[var(--ink-light)] max-w-xl mx-auto text-base leading-relaxed">
            Crisp is private and local-first. Built for you, not for algorithms.
          </p>

          {/* Sign Up CTA */}
          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 rounded-full font-bold bg-[var(--ink)] text-white hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Sign Up for Free
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
