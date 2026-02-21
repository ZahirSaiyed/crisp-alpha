"use client";

import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, signOut } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);



  // Close menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking inside the menu container (includes button and dropdown)
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      setShowUserMenu(false);
    };

    // Use a small delay to ensure button clicks fire first
    // Then add listener in bubble phase (not capture) to allow button handlers to execute
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
  };

  // Hide header on landing page
  if (pathname === "/") return null;

  // Use neutral header (ink/ink-light) on all non-landing pages for design-guide consistency
  const logoClass =
    "display-headline text-[var(--ink)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[-0.02em]";
  const linkClass =
    "text-sm font-medium text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors";
  const signUpClass =
    "px-4 py-2 rounded-full bg-[var(--ink)] text-white text-sm font-medium hover:bg-[var(--ink)]/90 transition-all duration-200";
  const avatarClass =
    "w-8 h-8 rounded-full bg-[var(--ink)] flex items-center justify-center text-white text-sm font-medium hover:opacity-90 transition-all duration-200";

  return (
    <div className="w-full pt-4 sm:pt-6 pb-4 sm:pb-6 relative z-50">
      <header
        className="mx-auto w-full max-w-[95%] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl px-6 py-3 rounded-full bg-white/80 backdrop-blur-md border border-[var(--muted-2)] shadow-lg shadow-black/5 relative"
      >
        <div className="flex items-center gap-6 sm:gap-8 min-h-[2.5rem]">
          <Link href="/" className="flex items-center">
            <span className={logoClass}>
              Crisp
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-5 sm:gap-6">
            {user && (
              <Link
                href="/dashboard"
                className={linkClass}
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/privacy"
              className={`flex items-center gap-1.5 ${linkClass} hidden sm:flex`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>Privacy</span>
            </Link>
            {!user && (
              <Link
                href="/signup"
                className={signUpClass}
              >
                Sign up
              </Link>
            )}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(!showUserMenu);
                  }}
                  className={avatarClass}
                  aria-label="User menu"
                >
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </button>
                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[var(--muted-2)] overflow-hidden z-[9999]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div className="px-4 py-3 border-b border-[var(--muted-2)]">
                      <p className="text-xs text-[var(--ink-light)]">Signed in as</p>
                      <p className="text-sm font-medium text-[var(--ink)] truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSignOut();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-[var(--ink-light)] hover:bg-[var(--muted-1)] active:bg-[var(--muted-2)] transition-colors cursor-pointer focus:outline-none focus:bg-[var(--muted-1)]"
                      style={{ pointerEvents: 'auto' }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
} 