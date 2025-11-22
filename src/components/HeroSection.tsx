"use client";

import { motion } from "framer-motion";
import ScenarioInput, { type Intent } from "./ScenarioInput";

interface HeroSectionProps {
  onGenerate: (scenario: string, intent: Intent) => void;
  isLoading: boolean;
}

export default function HeroSection({ onGenerate, isLoading }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[var(--muted-1)]/50 to-transparent rounded-full blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto text-center space-y-8 sm:space-y-12">
        {/* Main Headline Group */}
        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter text-[var(--ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Clarity is Power.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl md:text-2xl text-[var(--ink-light)] max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Your voice is how the world meets your mind. <br className="hidden sm:block" />
            Crisp trains both.
          </motion.p>
        </div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl mx-auto"
        >
          <ScenarioInput onGenerate={onGenerate} isLoading={isLoading} />
        </motion.div>
      </div>
    </section>
  );
}
