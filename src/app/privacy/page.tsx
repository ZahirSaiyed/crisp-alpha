import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & Terms - Crisp",
  description: "Privacy policy and terms of service for Crisp",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-warm)] text-[var(--ink)]">
      <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <h1 className="text-3xl font-bold text-[var(--ink)] mb-8 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Privacy & Terms</h1>
        
        <div className="prose prose-lg max-w-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink)] mb-3">What we collect</h2>
              <p className="text-[var(--ink-light)]">Audio clips are sent for analysis automatically when you finish recording. We do not collect any personal information or store your recordings.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink)] mb-3">Data retention</h2>
              <p className="text-[var(--ink-light)]">Zero. Your audio is processed in real-time and immediately discarded. We do not store, save, or retain any of your recordings or transcripts.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink)] mb-3">Third parties</h2>
              <p className="text-[var(--ink-light)]">We use Deepgram for transcription and Google Gemini for AI feedback. Both services process your audio statelessly and do not retain your data.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[var(--ink)] mb-3">Your rights</h2>
              <p className="text-[var(--ink-light)]">Since we don&apos;t store anything, there&apos;s nothing to delete. Your audio is processed and immediately discarded.</p>
            </div>
            
            <div>
              <p className="text-sm text-[var(--ink-light)]">Last updated: October 2025</p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-[var(--muted-2)]">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-[var(--ink-light)] hover:text-[var(--ink)] transition-colors"
          >
            ← Back to Crisp
          </Link>
        </div>
      </div>
    </main>
  );
}
