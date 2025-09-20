import Link from "next/link";
import Recorder from "../../components/recorder";

export default function RecordPage() {
  return (
    <main className="min-h-screen hero-light-gradient-warm text-[color:var(--ink)]">
      <Link href="/" className="fixed top-6 left-6 z-50 text-[#7C3CDF] text-3xl sm:text-5xl font-semibold tracking-wide display-wordmark">CRISP</Link>
      <section className="relative mx-auto max-w-5xl px-6 min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <Recorder stickyMobileCTA={false} appearance="onLight" />
      </section>
      <div className="h-16 sm:h-0" />
    </main>
  );
} 