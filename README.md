# Crisp

**Deliberate communication practice, powered by AI.**

Most feedback on how you speak is late, vague, and subjective. Crisp gives you the rep, the data, and the next rep — in under two minutes.

---

## What it does

1. **Set your scenario** — paste a context (e.g. "onsite interview with Mintlify founders") and pick a communication intent (decisive, natural, calm, persuasive, empathetic)
2. **Get tailored prompts** — Gemini generates 3 practice questions matched to your scenario and intent
3. **Record your answer** — browser-native recording, no installs
4. **Get instant metrics** — WPM, filler word counts, pause analysis, end-rush detection, all computed client-side in a Web Worker
5. **Get streamed AI feedback** — structured coaching (Strengths / Weaknesses / Recommendations) streams in progressively as Gemini generates it, section by section

---

## Tech

| Layer | Stack |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Transcription | Deepgram Nova-2 (filler words, paragraphs, word-level timestamps) |
| AI | Google Gemini 2.5 Flash (`generateContentStream`) |
| Auth + DB | Supabase (auth, session history) |
| Analytics | PostHog |
| Audio processing | Web Worker + Comlink (PCM decoding off main thread) |

### A few things worth noting

- **Metrics run entirely in the browser** — WPM, pauses, fillers, end-rush index all computed in a `metrics.worker.ts` via Comlink. No audio ever leaves the client for analysis.
- **Feedback streams** — the `/api/feedback` route uses `generateContentStream` and pipes a `ReadableStream` directly to the client. The frontend parses sections progressively as text arrives, rendering structured UI starting ~500ms after the transcript loads.
- **Audio privacy** — recorded audio is decoded to PCM for analysis and transcribed via Deepgram, then immediately discarded. Nothing is stored server-side.
- **Intent theming** — selecting a communication intent applies a CSS variable theme across the entire UI in real time.

---

## Running locally

```bash
cp .env.example .env.local
# fill in DEEPGRAM_API_KEY, GEMINI_API_KEY, and optionally Supabase + PostHog keys

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See `.env.example` for all environment variables with descriptions.

---

## Project structure

```
src/
  app/
    api/
      feedback/     # Gemini streaming feedback
      prompts/      # Scenario-based prompt generation
      transcribe/   # Deepgram transcription
      sessions/     # Session persistence (Supabase)
      guided/       # Guided prep path from job description
  components/
    FeedbackTile    # Progressive streaming feedback UI
    MetricsTile     # Real-time delivery metrics
    RecordingTakeover  # Full-screen recording flow
    TranscriptPlayerCard  # Synchronized transcript + audio player
  lib/
    analysis.ts     # Filler detection, pause detection, strategic pause coverage
    delivery.ts     # Delivery summary types
    focus.ts        # Focus selection logic (goal → drill)
    metrics.ts      # Session metric scoring
  workers/
    metrics.worker.ts  # Off-thread PCM analysis via Comlink
```
