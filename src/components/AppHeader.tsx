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
        <Link href="/" className="display-headline text-[color:var(--bright-purple)] text-3xl sm:text-4xl lg:text-5xl font-extrabold drop-shadow-[0_4px_16px_rgba(122,92,255,0.25)] tracking-[-0.01em]">
          Crisp
        </Link>
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
            className="flex items-center gap-1.5 text-sm text-[color:rgba(11,11,12,0.6)] hover:text-[color:var(--ink)] transition-colors hidden sm:flex"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Privacy</span>
          </Link>
          {!user && (
            <Link
              href="/signup"
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[color:var(--bright-purple)] to-[color:#9D7FFF] text-white text-sm font-semibold shadow-[0_4px_12px_rgba(122,92,255,0.25)] hover:shadow-[0_6px_20px_rgba(122,92,255,0.35)] transition-all duration-200 transform hover:scale-105"
            >
              Sign up
            </Link>
          )}
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
    </motion.header>
  );
} 