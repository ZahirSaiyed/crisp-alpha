"use client";

import { motion } from "framer-motion";

export default function VisionBlock() {
    return (
        <section id="vision" className="py-32 sm:py-48 px-6 bg-[var(--bg-warm)] text-center">
            <div className="max-w-3xl mx-auto space-y-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--ink)] mb-8 tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
                        Crisp isn’t a product. <br />
                        It’s a standard.
                    </h2>
                </motion.div>

                <div className="space-y-6 text-lg sm:text-xl text-[var(--ink-light)] font-medium">
                    <p>The world doesn’t reward volume.</p>
                    <p>It rewards clarity.</p>
                    <p className="text-[var(--intent-persuasive)] font-bold">Crisp gives you both.</p>
                </div>
            </div>
        </section>
    );
}
