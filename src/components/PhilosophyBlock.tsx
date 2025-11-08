"use client";

import React, { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

const steps = [
  {
    number: "1",
    label: "Describe your moment",
    description: "Tell Crisp what's ahead — a job interview, tough conversation, or presentation — and how you want to come across.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--intent-decisive)]">
        <path d="M3 21L12 21H21" />
        <path d="M12.2218 5.82839L15.0503 2.99996L20 7.94971L17.1716 10.7781M12.2218 5.82839L6.61522 11.435C6.42769 11.6225 6.32233 11.8769 6.32233 12.1421L6.32233 16.6776L10.8579 16.6776C11.1231 16.6776 11.3774 16.5723 11.565 16.3847L17.1716 10.7781M12.2218 5.82839L17.1716 10.7781" />
      </svg>
    ),
    color: "var(--intent-decisive)",
  },
  {
    number: "2",
    label: "Practice out loud",
    description: "Get custom prompts and instant feedback on tone, pace, and clarity. Hear how you actually sound.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--intent-natural)]">
        <path d="M14 21.8C13.3538 21.9311 12.6849 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 12.254 21.9905 12.5057 21.9719 12.7549" />
        <path d="M12 6L12 18" />
        <path d="M9 9L9 15" />
        <path d="M18 11L18 13" />
        <path d="M6 11L6 13" />
        <path d="M15 7L15 17" />
        <path d="M21.1667 18.5H21.4C21.7314 18.5 22 18.7686 22 19.1V21.4C22 21.7314 21.7314 22 21.4 22H17.6C17.2686 22 17 21.7314 17 21.4V19.1C17 18.7686 17.2686 18.5 17.6 18.5H17.8333M21.1667 18.5V16.75C21.1667 16.1667 20.8333 15 19.5 15C18.1667 15 17.8333 16.1667 17.8333 16.75V18.5M21.1667 18.5H17.8333" />
      </svg>
    ),
    color: "var(--intent-natural)",
  },
  {
    number: "3",
    label: "See your results",
    description: "Track your progress and enter the real moment with confidence.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--intent-calm)]">
        <path d="M20 20H4V4" />
        <path d="M4 16.5L12 9L15 12L19.5 7.5" />
      </svg>
    ),
    color: "var(--intent-calm)",
  },
];

export default function PhilosophyBlock() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-200px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  return (
    <section ref={ref} className="relative mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-28">
      {/* Decorative divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[color:var(--muted-2)] to-transparent opacity-30" />
      
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color:var(--intent-calm)]/3 to-transparent" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[color:var(--ink)] leading-tight mb-3"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            How Crisp Works
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg sm:text-xl text-[color:rgba(11,11,12,0.7)] max-w-2xl mx-auto leading-relaxed font-medium"
          >
            You bring the moment. Crisp helps you get ready for it.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 mt-16 sm:mt-20">
          {steps.map((step, index) => {
            const stepRef = useRef<HTMLDivElement>(null);
            const stepInView = useInView(stepRef, { once: false, margin: "-150px" });
            const stepScrollProgress = useScroll({
              target: stepRef,
              offset: ["start end", "center center"]
            }).scrollYProgress;
            
            const y = useTransform(stepScrollProgress, [0, 1], [50, 0]);
            const opacity = useTransform(stepScrollProgress, [0, 0.3, 0.7, 1], [0, 0.5, 1, 1]);
            const scale = useTransform(stepScrollProgress, [0, 0.5, 1], [0.9, 0.95, 1]);
            
            return (
              <motion.div
                key={step.number}
                ref={stepRef}
                style={{ 
                  y,
                  opacity,
                  scale,
                  willChange: 'transform, opacity'
                }}
                whileHover={{ 
                  y: -4,
                  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
                }}
                className="flex flex-col items-center text-center cursor-default"
              >
                {/* Icon */}
                <motion.div 
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm border mb-4"
                  style={{ 
                    background: step.color === "var(--intent-decisive)" 
                      ? "linear-gradient(to bottom right, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))"
                      : step.color === "var(--intent-natural)"
                      ? "linear-gradient(to bottom right, rgba(14, 165, 233, 0.15), rgba(14, 165, 233, 0.05))"
                      : "linear-gradient(to bottom right, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))",
                    borderColor: step.color === "var(--intent-decisive)"
                      ? "rgba(245, 158, 11, 0.2)"
                      : step.color === "var(--intent-natural)"
                      ? "rgba(14, 165, 233, 0.2)"
                      : "rgba(16, 185, 129, 0.2)",
                    willChange: 'transform',
                    rotate: useTransform(stepScrollProgress, [0, 1], [-180, 0]),
                    scale: useTransform(stepScrollProgress, [0, 0.5, 1], [0, 0.8, 1])
                  }}
                  whileHover={{ 
                    scale: 1.1,
                    rotate: 5,
                    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
                  }}
                >
                  {step.icon}
                </motion.div>
                
                {/* Step number and label */}
                <motion.div 
                  className="mb-3"
                  style={{
                    opacity: useTransform(stepScrollProgress, [0.2, 0.5], [0, 1])
                  }}
                >
                  <span className="text-sm font-semibold text-[color:rgba(11,11,12,0.5)] mr-2">{step.number}.</span>
                  <h3 className="text-xl font-bold text-[color:var(--ink)] leading-tight inline">
                    {step.label}
                  </h3>
                </motion.div>
                
                {/* Description */}
                <motion.p 
                  className="text-base text-[color:rgba(11,11,12,0.7)] leading-relaxed font-normal max-w-[280px]"
                  style={{
                    opacity: useTransform(stepScrollProgress, [0.4, 0.7], [0, 1])
                  }}
                >
                  {step.description}
                </motion.p>
              </motion.div>
            );
          })}
        </div>

        {/* Supporting line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mt-12 sm:mt-16 text-base sm:text-lg text-[color:rgba(11,11,12,0.6)] font-medium italic"
        >
          Every session turns uncertainty into clarity — in just a few minutes.
        </motion.p>
      </div>
    </section>
  );
}

