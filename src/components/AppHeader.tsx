"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function AppHeader() {
  const [mounted, setMounted] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, signOut } = useAuth();
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 200], [0.7, 0.9]);
  const bg = useMotionTemplate`rgba(255,255,255,${bgOpacity})`;
  const shadow = useTransform(scrollY, [0, 80], [
    "0 10px 30px rgba(0,0,0,0)",
    "0 10px 30px rgba(0,0,0,0.08)",
  ]);
  const height = useTransform(scrollY, [0, 200], [72, 60]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <motion.header
      className="sticky top-0 z-50 border-b border-[color:var(--muted-2)] backdrop-blur-[6px]"
      style={mounted ? {
        backgroundColor: bg,
        boxShadow: shadow,
        height,
      } : {
        backgroundColor: 'rgba(255,255,255,0.7)',
        boxShadow: '0 10px 30px rgba(0,0,0,0)',
        height: 72,
      }}
    >
      <div className="mx-auto max-w-7xl px-6 h-full flex items-center gap-3">
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
          <Link href="/" className="display-wordmark text-[color:var(--bright-purple)] text-3xl sm:text-5xl font-semibold tracking-wide">
            CRISP
          </Link>
        </motion.div>
        <div className="ml-auto flex items-center gap-4">
          {user && (
            <Link
              href="/dashboard"
              className="text-sm font-medium text-[color:var(--bright-purple)] hover:text-[color:var(--ink)] transition-colors"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/privacy"
            className="text-sm text-[color:rgba(11,11,12,0.6)] hover:text-[color:var(--ink)] transition-colors hidden sm:block"
          >
            Privacy
          </Link>
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-gradient-to-r from-[color:var(--bright-purple)] to-[color:#9D7FFF] flex items-center justify-center text-white text-sm font-semibold hover:shadow-[0_4px_12px_rgba(122,92,255,0.35)] transition-all"
                aria-label="User menu"
              >
                {user.email?.[0]?.toUpperCase() || 'U'}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[color:var(--muted-2)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[color:var(--muted-2)]">
                    <p className="text-xs text-[color:rgba(11,11,12,0.6)]">Signed in as</p>
                    <p className="text-sm font-medium text-[color:var(--ink)] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-[color:rgba(11,11,12,0.8)] hover:bg-gray-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <MotionProgressBar />
    </motion.header>
  );
}

function MotionProgressBar() {
  const { scrollYProgress } = useScroll();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      className="absolute left-0 right-0 top-full h-[3px] origin-left"
      style={{ 
        scaleX: mounted ? scrollYProgress : 0, 
        background: "linear-gradient(90deg, var(--bright-lime), var(--bright-purple))" 
      }}
    />
  );
} 