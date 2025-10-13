"use client";

import MagneticCTA from "../components/MagneticCTA";
import posthog from "posthog-js";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    posthog.capture('viewed_landing_page');
  }, []);
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F9F9FB] via-white to-[#F7F4EF] text-[color:var(--ink)]">
      <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] grid grid-cols-1 items-center">
        {/* Headline + subcopy */}
        <header className="text-center mx-auto">
          <h1 className="display-headline text-[36px] sm:text-[52px] lg:text-[64px] leading-[1.08] tracking-[-0.01em] font-extrabold">
            <span className="text-[color:var(--bright-purple)] drop-shadow-[0_2px_8px_rgba(122,92,255,0.15)]">Crisp.</span>{" "}
            <span className="text-[color:#0B0B0C]">Turn shaky moments into sharp delivery.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base font-medium text-[color:#0B0B0C] max-w-lg lg:max-w-2xl mx-auto leading-relaxed">
            Instant feedback and insights that help you sound as clear as you think.
          </p>
          <div className="mt-8 flex justify-center">
            <MagneticCTA href="/record">Start training</MagneticCTA>
          </div>
        </header>
      </section>

      <div className="h-16 sm:h-0" />
    </main>
  );
}