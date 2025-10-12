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

function inferMimeFromKey(key: string): string | undefined {
  const lower = key.toLowerCase();
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".weba")) return "audio/webm";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  return undefined;
}

function normalizeMime(m: string | undefined): string | undefined {
  if (!m) return undefined;
  const base = m.split(";")[0]?.trim();
  return base || undefined;
}

function buildDeepgramHints(mimetype?: string): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (mimetype) {
    const base = normalizeMime(mimetype);
    if (base) opts.mimetype = base;
  }
  return opts;
}

export async function POST(request: NextRequest) {
  try {
    // New path: JSON body with S3 object key -> fetch from S3
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({} as unknown));
      const obj = (body ?? {}) as Record<string, unknown>;
      const objectKey = typeof obj.objectKey === "string" ? obj.objectKey : undefined;
      if (objectKey) {
        const bucket = process.env.S3_BUCKET;
        const region = process.env.S3_REGION;
        if (!bucket || !region) {
          return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
        }
        // Lazy import AWS only when needed
        const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = new S3Client({ region });
        const getCmd = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
        const res = await s3.send(getCmd);
        const stream = res.Body as unknown as NodeJS.ReadableStream | undefined;
        if (!stream) {
          return NextResponse.json({ error: "Failed to read audio from storage" }, { status: 500 });
        }
        const audioBuffer = await streamToBuffer(stream);
        // Prefer S3 object ContentType; if absent, infer from key extension
        const s3ContentType = typeof res.ContentType === "string" ? res.ContentType : undefined;
        const inferredType = inferMimeFromKey(objectKey);
        const mimetype = normalizeMime(s3ContentType) || inferredType;

        // Use Deepgram REST to avoid SDK bundling issues
        const resp = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&filler_words=true&paragraphs=true&model=nova-2&language=en&detect_language=false", {
          method: "POST",
          headers: {
            "Authorization": `Token ${process.env.DEEPGRAM_API_KEY || ""}`,
            "Content-Type": (mimetype || "audio/webm") as string,
          },
          body: audioBuffer,
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          return NextResponse.json({ error: `Deepgram error: ${resp.status}`, _debug: { txt } }, { status: 500 });
        }
        const result = await resp.json();
        const dg = result as unknown as DeepgramResult;
        const alt = dg?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined;
        const transcript = alt?.transcript ?? undefined;
        const words = alt?.words ?? [];
        const paragraphs: Paragraph[] = mapParagraphs(alt);
        return NextResponse.json({ transcript: transcript || "No speech detected", words, paragraphs, _raw: result, source: "s3", _debug: { bytes: audioBuffer.byteLength, mimetype } });
      }
    }

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
    const fileMimeRaw = typeof (audioFile as unknown as { type?: string }).type === "string" ? (audioFile as unknown as { type?: string }).type : undefined;
    const fileMime = normalizeMime(fileMimeRaw);
    
    // Create Deepgram client
    const resp = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&filler_words=true&paragraphs=true&model=nova-2&language=en&detect_language=false", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY || ""}`,
        "Content-Type": (fileMime || "audio/webm") as string,
      },
      body: audioBuffer,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return NextResponse.json({ error: `Deepgram error: ${resp.status}`, _debug: { txt, bytes: audioBuffer.byteLength, mimetype: fileMime } }, { status: 500 });
    }
    const result = await resp.json();

    // Optionally save full result to fixture file on disk when SAVE_FIXTURE=true
    try {
      if (process.env.SAVE_FIXTURE === "true") {
        const fs = await import("fs");
        const path = await import("path");
        const fixturesDir = path.resolve(process.cwd(), "src/fixtures");
        const filePath = path.join(fixturesDir, "transcript.json");
        if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf8");
      }
    } catch (e) {
      console.warn("Could not save fixture:", e);
    }

    const dg = result as unknown as DeepgramResult;
    const alt = dg?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined;
    const transcript = alt?.transcript ?? undefined;
    const words = alt?.words ?? [];
    const paragraphs: Paragraph[] = mapParagraphs(alt);
  return NextResponse.json({ transcript: transcript || "No speech detected", words, paragraphs, _raw: result, source: "live", _debug: { bytes: audioBuffer.byteLength, mimetype: fileMime } });
    
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" }, 
      { status: 500 }
    );
  }
} 

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.once("end", () => resolve(Buffer.concat(chunks)));
    stream.once("error", reject);
  });
}