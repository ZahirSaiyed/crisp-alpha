"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Navbar() {
    return (
        <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        >
            <div className="pointer-events-auto bg-white/80 backdrop-blur-md border border-[var(--muted-2)] shadow-lg shadow-black/5 rounded-full px-6 py-3 flex items-center gap-8">
                <Link href="/" className="font-bold text-[var(--ink)] tracking-tight hover:opacity-70 transition-opacity">
                    Crisp.
                </Link>

                <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-[var(--ink-light)]">
                    <a href="#manifesto" className="hover:text-[var(--ink)] transition-colors">Manifesto</a>
                    <a href="#how-it-works" className="hover:text-[var(--ink)] transition-colors">How it Works</a>
                    <a href="#vision" className="hover:text-[var(--ink)] transition-colors">Vision</a>
                </div>

                <Link href="/signup" className="bg-[var(--ink)] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-black transition-colors">
                    Sign Up
                </Link>
            </div>
        </motion.nav>
    );
}
