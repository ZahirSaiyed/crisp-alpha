"use client";

import Link from "next/link";
import Recorder from "../../components/recorder";
import React from "react";

export default function RecordPage() {
  return (
    <main className="min-h-screen hero-light-gradient-warm text-[color:var(--ink)]">
      <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-6">
        <Recorder stickyMobileCTA={false} appearance="onLight" />
      </section>
      <div className="h-16 sm:h-0" />
    </main>
  );
} 