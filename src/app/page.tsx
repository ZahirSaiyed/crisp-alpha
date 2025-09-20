export default function Page() {
  return (
    <main className="min-h-screen mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold mb-4">Crisp v0.1 • Record → Playback</h1>
      <p className="text-sm text-gray-600 mb-6">
        Minimal, secure, cross-browser recorder. One button to start, then play it back.
      </p>
      {/* Client component handles all recording logic */}
      <Recorder />
    </main>
  );
}

// NOTE: We import lazily to avoid SSR issues in this minimal example.
// In a real app, put Recorder in a separate import with "use client".
import Recorder from "../components/recorder";