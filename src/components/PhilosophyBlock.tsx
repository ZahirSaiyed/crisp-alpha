"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    number: "01",
    title: "Define the Moment",
    description: "Tell Crisp what you're preparing for: a pitch, a difficult conversation, or a speech. Set your intent: Decisive, Natural, or Calm.",
  },
  {
    number: "02",
    title: "Speak & Record",
    description: "Practice out loud. Crisp listens not just to your words, but to your pacing, tone, and filler sounds.",
  },
  {
    number: "03",
    title: "Get Clarity Score",
    description: "Receive instant, objective feedback. See exactly where you drifted and how to tighten your delivery.",
  }
];

export default function PhilosophyBlock() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 bg-[var(--bg)] border-t border-[var(--muted-2)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--ink)] tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            How it Works
          </h2>
          <p className="text-[var(--ink-light)] max-w-xl mx-auto">
            Simple, private, and effective. Turn anxiety into articulation in three steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--muted-2)] to-transparent" />

          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative space-y-4 bg-[var(--bg)] z-10"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--bg-warm)] border border-[var(--muted-2)] flex items-center justify-center text-sm font-mono font-bold text-[var(--ink-light)] mb-6 mx-auto md:mx-0">
                {step.number}
              </div>

              <h3 className="text-xl font-bold text-[var(--ink)] tracking-tight">
                {step.title}
              </h3>
              <p className="text-[var(--ink-light)] leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
