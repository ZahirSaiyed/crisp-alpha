"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const BELIEFS = [
    "Most feedback on how you communicate is late, vague, and subjective.",
    "A friend says \"that was great.\" A manager says \"be more concise.\" Neither tells you anything you can act on today.",
    "Communication is a skill. Measurable. Improvable. Worth practicing deliberately.",
    "Not because you need to be a great speaker. Because unclear thinking sounds like unclear speaking. You probably have better ideas than you're currently able to express.",
    "This matters more now than it ever has.",
    "AI executes what you say. Literally. The quality of your output from a coding agent, a research tool, a writing assistant is a direct function of how clearly you think. Vague in. Vague out. Crisp in. Crisp out.",
    "The most important interface in 2026 is plain English. Most people have never practiced using it deliberately.",
];

export default function ManifestoBlock() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10%" });

    return (
        <section id="manifesto" className="py-24 sm:py-32 bg-[var(--ink)] text-white overflow-hidden">
            <div className="max-w-4xl mx-auto px-6">
                <div className="mb-16">
                    <span className="text-[var(--intent-decisive)] font-mono text-sm tracking-wider uppercase">The Manifesto</span>
                </div>

                <div ref={ref} className="space-y-12">
                    {BELIEFS.map((belief, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                            viewport={{ once: true, margin: "-10%" }}
                            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="group"
                        >
                            <p className="text-2xl sm:text-3xl md:text-4xl font-medium leading-tight text-[var(--muted-2)] group-hover:text-white transition-colors duration-500">
                                {belief}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    className="mt-24 pt-12 border-t border-white/10"
                >
                    <p className="text-lg text-white/60 max-w-2xl">
                        Crisp gives you the rep. The data. The next rep.<br />That&apos;s it.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
