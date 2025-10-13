import MagneticCTA from "../components/MagneticCTA";

export default function Page() {
  return (
    <main className="min-h-screen hero-light-gradient-warm text-[color:var(--ink)]">
      <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] grid grid-cols-1 items-center">
        {/* Headline + subcopy */}
        <header className="text-center mx-auto">
          <h1 className="display-headline text-[36px] sm:text-[52px] lg:text-[64px] leading-[1.08] tracking-[-0.01em] font-extrabold">
            <span className="text-[color:#7C3CDF]">Crisp.</span>{" "}
            <span className="text-[color:#0B0B0C]">The easiest way to improve your speaking.</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base font-medium text-[color:#0B0B0C] max-w-lg mx-auto">
            Instant playback, insights, and tools that actually help you grow.
          </p>
          <p className="mt-2 text-xs text-[color:rgba(11,11,12,0.6)] max-w-md mx-auto">
            Runs in your browser. Nothing uploaded until you tap Analyze.
          </p>
          <div className="mt-6 flex justify-center">
            <MagneticCTA href="/record">Start training</MagneticCTA>
          </div>
        </header>
      </section>

      <div className="h-16 sm:h-0" />
    </main>
  );
}