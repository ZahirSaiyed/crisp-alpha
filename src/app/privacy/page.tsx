import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & Terms - Crisp",
  description: "Privacy policy and terms of service for Crisp",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-[color:var(--ink)]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy & Terms</h1>
        
        <div className="prose prose-lg max-w-none">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-3">What we collect</h2>
              <p>Audio clips are sent for analysis only when you tap &quot;Analyze&quot; after recording. We do not collect any personal information or store your recordings.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-3">Data retention</h2>
              <p>Zero. Your audio is processed in real-time and immediately discarded. We do not store, save, or retain any of your recordings or transcripts.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-3">Third parties</h2>
              <p>We use Deepgram for transcription and Google for AI feedback. Both services process your audio statelessly and do not retain your data.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-3">Your rights</h2>
              <p>Since we don&apos;t store anything, there&apos;s nothing to delete. Your audio is processed and immediately discarded.</p>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-3">Contact & jurisdiction</h2>
              <p>Questions? Contact us at privacy@crisp.app. Last updated: December 2024. Jurisdiction: United States.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link 
            href="/" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Crisp
          </Link>
        </div>
      </div>
    </main>
  );
}
