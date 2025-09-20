import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen hero-light-gradient-warm text-[color:var(--ink)]">
      {/* Wordmark */}
      <div className="fixed top-6 left-6 z-50">
        <Link
          href="/"
          className="text-[#7C3CDF] text-3xl sm:text-5xl font-semibold tracking-wide display-wordmark"
        >
          CRISP
        </Link>
      </div>

      <section className="relative mx-auto max-w-6xl px-6 min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Headline + subcopy */}
        <header className="text-left lg:pr-8">
          <h1 className="display-headline text-[56px] sm:text-[72px] leading-[1.02] font-semibold tracking-[-0.01em]">
            Train your voice.
          </h1>
          <p className="mt-5 text-lg text-[color:rgba(11,11,12,0.8)] max-w-xl">
            Smart recommendations tailored to your speaking goals.
          </p>
        </header>

        {/* Right: Fake phone tile */}
        <div className="relative w-full mx-auto max-w-md">
          <div className="rounded-[28px] border border-[color:var(--muted-2)] bg-white/70 backdrop-blur-[2px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#7A5CFF] via-[#7A5CFF]/80 to-[#6ED0FF] p-4 text-white font-medium">
              CRISP All‑Stars →
            </div>
            <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#C9FF2F] to-[#6ED0FF] p-4 text-[color:var(--ink)] font-medium">
              Clarity Focus →
            </div>
            <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#FF6B5E] to-[#FFE900] p-4 text-[color:var(--ink)] font-medium">
              Pace Booster →
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[color:rgba(11,11,12,0.6)]">
              <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">135 WPM</div>
              <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">Energy ↑</div>
              <div className="rounded-lg border border-[color:var(--muted-2)] bg-white/70 p-2 text-center">Pauses ↓</div>
            </div>
          </div>

          {/* Bottom-right CTA aligned under tile */}
          <div className="mt-6 flex justify-end">
            <Link href="/record" className="cta-ylw px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold">
              Start training
            </Link>
          </div>
        </div>
      </section>

      <div className="h-16 sm:h-0" />
    </main>
  );
}