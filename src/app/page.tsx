"use client";

import MagneticCTA from "../components/MagneticCTA";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Link from "next/link";

export default function Page() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const isHeroInView = useInView(heroRef, { once: true, margin: "-100px" });
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll();
  const gradientY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  useEffect(() => {
    posthog.capture('viewed_landing_page');
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F9F9FB] via-white to-[#F7F4EF] text-[color:var(--ink)] overflow-hidden">
      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-16 pb-20 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40 xl:pt-40 xl:pb-44 overflow-hidden">
        {/* Breathing gradient background - edge to edge */}
        <motion.div 
          className="absolute inset-0 w-screen overflow-hidden pointer-events-none"
          style={{ y: gradientY, left: '50%', marginLeft: '-50vw', width: '100vw' }}
        >
          <div className="hero-gradient-mesh hero-breathing" />
          <div className="hero-gradient-warmth" />
        </motion.div>
        
        <div className="relative z-10 text-center mx-auto max-w-4xl px-4 sm:px-6">
          {/* Opening: Crisp. Built for the human voice in an AI world. */}
          <motion.div
            className="relative z-10 mb-3 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="display-headline text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-[color:#0B0B0C] leading-[1.15] sm:leading-[1.1] tracking-[-0.02em] mb-2 relative px-1">
              <span className="text-[color:var(--bright-purple)] drop-shadow-[0_4px_16px_rgba(122,92,255,0.25)]">Crisp.</span>{" "}
              <span className="font-normal text-[color:#0B0B0C]">Built for the human voice in an AI world.</span>
            </h1>
          </motion.div>

          {/* Main value proposition */}
          <motion.p
            className="text-lg sm:text-2xl lg:text-3xl font-medium text-[color:#0B0B0C] max-w-3xl mx-auto leading-[1.4] sm:leading-relaxed mb-6 sm:mb-10 relative z-10 px-1"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            A voice coach that grows with you.
          </motion.p>

          {/* CTA with trust builders */}
          <motion.div
            className="flex flex-col items-center gap-2 relative z-10 mb-8 sm:mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="cta-enhanced-wrapper">
              <MagneticCTA href="/record">Start now</MagneticCTA>
            </div>
            <p className="text-xs sm:text-sm text-[color:rgba(11,11,12,0.65)] font-medium tracking-wide uppercase mt-1">
              Private. Real-time. Human-first.
            </p>
          </motion.div>

          {/* Optional micro detail - fades in after */}
          <motion.p
            className="text-xs sm:text-base text-[color:rgba(11,11,12,0.6)] max-w-xl mx-auto mt-6 sm:mt-10 relative z-10 italic px-2"
            initial={{ opacity: 0, y: 10 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.2, delay: 2, ease: [0.22, 1, 0.36, 1] }}
          >
            Because in the age of AI, how you sound is your edge.
          </motion.p>
        </div>
      </section>

      {/* Features Grid Section */}
      <section ref={featuresRef} className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 lg:gap-10">
          {/* Memory Feature */}
          <motion.div
            className="feature-card feature-card-memory group"
            initial={{ opacity: 0, y: 40 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 sm:mb-5">
              <div className="feature-number text-[#4F46E5] text-5xl sm:text-6xl font-extrabold opacity-50">01</div>
            </div>
            <h2 className="display-headline text-xl sm:text-2xl font-bold text-[#1E1B4B] mb-3 sm:mb-4 tracking-[-0.01em]">Memory</h2>
            <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
              Every session builds your voice profile. We remember your pace, clarity, and confidence — and show you how you&apos;re growing.
            </p>
          </motion.div>

          {/* Dialogue Feature */}
          <motion.div
            className="feature-card feature-card-dialogue group"
            initial={{ opacity: 0, y: 40 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 sm:mb-5">
              <div className="feature-number text-[#0891B2] text-5xl sm:text-6xl font-extrabold opacity-50">02</div>
            </div>
            <h2 className="display-headline text-xl sm:text-2xl font-bold text-[#164E63] mb-3 sm:mb-4 tracking-[-0.01em]">Dialogue</h2>
            <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
              Move beyond one-way feedback. Crisp coaches you live as you speak, responding in real-time like a mentor, not a metrics board.
            </p>
          </motion.div>

          {/* Evolution Feature */}
          <motion.div
            className="feature-card feature-card-evolution group"
            initial={{ opacity: 0, y: 40 }}
            animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 sm:mb-5">
              <div className="feature-number text-[#059669] text-5xl sm:text-6xl font-extrabold opacity-50">03</div>
            </div>
            <h2 className="display-headline text-xl sm:text-2xl font-bold text-[#064E3B] mb-3 sm:mb-4 tracking-[-0.01em]">Evolution</h2>
            <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
              Crisp adapts to your goals. Whether you&apos;re prepping for a presentation, investor pitch, or content creation, your coach evolves with you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="display-headline text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-[color:var(--ink)] mb-4 sm:mb-6 tracking-[-0.01em]">
            Ready to sound your best?
          </h2>
          <Link
            href="/record"
            className="cta-bottom-purple"
          >
            Start training
          </Link>
        </div>
      </section>

      <div className="h-12 sm:h-16" />

      {/* Footer */}
      <footer className="border-t border-[color:var(--muted-2)] py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-[color:rgba(11,11,12,0.5)] font-medium">
              Built for the human voice in an AI world
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}