import { createClient } from "@deepgram/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type DeepgramWord = { word?: string; start?: number; end?: number; confidence?: number };
type DeepgramAlternative = { transcript?: string; words?: DeepgramWord[] };
type DeepgramResult = {
  results?: {
    channels?: Array<{
      alternatives?: DeepgramAlternative[];
    }>;
  };
};

type Paragraph = { text?: string; start?: number; end?: number };

type DgSentence = { text?: string; start?: number; end?: number };
type DgParagraph = { sentences?: DgSentence[] };
type DgParagraphs = { paragraphs?: DgParagraph[] };

type DeepgramAlternativeWithParagraphs = DeepgramAlternative & { paragraphs?: DgParagraphs };

function mapParagraphs(alt: DeepgramAlternativeWithParagraphs | undefined): Paragraph[] {
  const out: Paragraph[] = [];
  const paras = alt?.paragraphs?.paragraphs;
  if (Array.isArray(paras)) {
    for (const p of paras) {
      const sents = Array.isArray(p?.sentences) ? p.sentences : [];
      if (sents.length > 0) {
        const text = sents.map((s) => (typeof s?.text === "string" ? s.text : "")).join(" ").trim();
        const start = typeof sents[0]?.start === "number" ? sents[0].start : undefined;
        const end = typeof sents[sents.length - 1]?.end === "number" ? sents[sents.length - 1].end : undefined;
        out.push({ text, start, end });
      }
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    // If fixture mode is on, return the saved JSON from disk
    if (process.env.USE_FIXTURE === "true") {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.resolve(process.cwd(), "src/fixtures/transcript.json");
        if (!fs.existsSync(filePath)) {
          return NextResponse.json({ error: "Fixture not found. Add src/fixtures/transcript.json" }, { status: 500 });
        }
        const txt = fs.readFileSync(filePath, "utf8");
        const json = JSON.parse(txt) as DeepgramResult;
        const alt = json?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined;
        const transcript = alt?.transcript ?? undefined;
        const words = alt?.words ?? [];
        const paragraphs: Paragraph[] = mapParagraphs(alt);
        return NextResponse.json({ transcript: transcript || "No speech detected", words, paragraphs, _raw: json, source: "fixture" });
      } catch {
        return NextResponse.json({ error: "Failed to load fixture" }, { status: 500 });
      }
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Convert File to Buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Create Deepgram client
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY || "");
    
    // Transcribe the audio
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-2",
        smart_format: true,
        filler_words: true,
        paragraphs: true,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the Deepgram result (trimmed)
    try {
      const preview = JSON.stringify(result).slice(0, 5000);
      console.log("Deepgram result preview:", preview);
    } catch {}

    // Optionally save full result to fixture file on disk when SAVE_FIXTURE=true
    try {
      if (process.env.SAVE_FIXTURE === "true") {
        const fs = await import("fs");
        const path = await import("path");
        const fixturesDir = path.resolve(process.cwd(), "src/fixtures");
        const filePath = path.join(fixturesDir, "transcript.json");
        if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf8");
        console.log(`Saved Deepgram fixture to ${filePath}`);
      }
    } catch (e) {
      console.warn("Could not save fixture:", e);
    }

    const dg = result as unknown as DeepgramResult;
    const alt = dg?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined;
    const transcript = alt?.transcript ?? undefined;
    const words = alt?.words ?? [];
    const paragraphs: Paragraph[] = mapParagraphs(alt);
    return NextResponse.json({ transcript: transcript || "No speech detected", words, paragraphs, _raw: result, source: "live" });
    
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" }, 
      { status: 500 }
    );
  }
} 