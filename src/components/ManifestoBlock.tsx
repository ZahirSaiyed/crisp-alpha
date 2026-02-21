"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const BELIEFS = [
    "We believe the mind and voice are a single instrument.",
    "We reject the culture of verbal clutter.",
    "We believe confidence is the outcome of clarity.",
    "We believe ideas deserve form: structured, simple, and strong.",
    "We believe speaking well is not extroversion. It is precision.",
    "We believe pressure does not create clarity. It exposes it.",
    "We believe silence is not emptiness. Silence is space to think.",
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
                        Crisp exists to rebuild what school, social media, and corporate chaos have broken: attention, articulation, and cognitive discipline.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
