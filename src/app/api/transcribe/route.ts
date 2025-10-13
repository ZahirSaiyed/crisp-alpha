import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Disable body parser to handle streaming with size limits
export const config = {
  api: {
    bodyParser: false,
  },
};

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


function normalizeMime(m: string | undefined): string | undefined {
  if (!m) return undefined;
  const base = m.split(";")[0]?.trim();
  return base || undefined;
}


export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 10);
  const startTime = Date.now();
  
  try {
    // Security: Check origin header
    const origin = request.headers.get('origin');
    const expectedOrigin = process.env.NEXT_PUBLIC_BASE_URL;
    if (origin && expectedOrigin && origin !== expectedOrigin) {
      console.log(`[transcribe] status=403 origin_mismatch requestId=${requestId}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Security: Check content type (allow multipart/form-data for FormData uploads)
    const contentType = request.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");
    const allowedMimes = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav'];
    
    if (!isFormData && !allowedMimes.some(m => contentType.includes(m))) {
      console.log(`[transcribe] status=400 invalid_mime=${contentType} requestId=${requestId}`);
      return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
    }

    // If fixture mode is on (dev only), return the saved JSON from disk
    if (process.env.NODE_ENV !== 'production' && process.env.USE_FIXTURE === "true") {
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

    let audioBuffer: Buffer;
    let fileMime: string | undefined;

    if (isFormData) {
      // Handle FormData upload
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;
      
      if (!audioFile) {
        console.log(`[transcribe] status=400 no_audio_file requestId=${requestId}`);
        return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
      }

      // Check file size
      if (audioFile.size > 20 * 1024 * 1024) { // 20MB
        console.log(`[transcribe] status=413 size_exceeded=${audioFile.size} requestId=${requestId}`);
        return NextResponse.json({ error: "File too large" }, { status: 413 });
      }

      // Validate MIME type
      const fileType = audioFile.type;
      if (!allowedMimes.some(m => fileType.includes(m))) {
        console.log(`[transcribe] status=400 invalid_file_mime=${fileType} requestId=${requestId}`);
        return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
      }

      audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      fileMime = normalizeMime(fileType);
    } else {
      // Handle direct binary upload
      const chunks: Buffer[] = [];
      let size = 0;
      const MAX_SIZE = 20 * 1024 * 1024; // 20MB
      
      const reader = request.body?.getReader();
      if (!reader) {
        console.log(`[transcribe] status=400 no_body requestId=${requestId}`);
        return NextResponse.json({ error: "No audio data provided" }, { status: 400 });
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          size += value.length;
          if (size > MAX_SIZE) {
            console.log(`[transcribe] status=413 size_exceeded=${size} requestId=${requestId}`);
            return NextResponse.json({ error: "File too large" }, { status: 413 });
          }
          
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }

      audioBuffer = Buffer.concat(chunks);
      fileMime = normalizeMime(contentType);
    }
    
    // Create Deepgram client with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
    
    try {
      const resp = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&filler_words=true&paragraphs=true&model=nova-2&language=en&detect_language=false", {
        method: "POST",
        headers: {
          "Authorization": `Token ${process.env.DEEPGRAM_API_KEY || ""}`,
          "Content-Type": (fileMime || "audio/webm") as string,
        },
        body: audioBuffer,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) {
        console.log(`[transcribe] status=500 deepgram_error=${resp.status} requestId=${requestId}`);
        return NextResponse.json({ error: `Transcription failed` }, { status: 500 });
      }
      
      const result = await resp.json();

      const dg = result as unknown as DeepgramResult;
      const alt = dg?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined;
      const transcript = alt?.transcript ?? undefined;
      const words = alt?.words ?? [];
      const paragraphs: Paragraph[] = mapParagraphs(alt);
      
      const duration = Date.now() - startTime;
      console.log(`[transcribe] status=200 duration=${duration}ms requestId=${requestId}`);
      
      // Immediately free the audio buffer
      audioBuffer.fill(0);
      
      return NextResponse.json({ 
        transcript: transcript || "No speech detected", 
        words, 
        paragraphs, 
        source: "live" 
      });
      
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[transcribe] status=408 timeout duration=${duration}ms requestId=${requestId}`);
        return NextResponse.json({ error: "Request timeout" }, { status: 408 });
      }
      console.log(`[transcribe] status=500 error duration=${duration}ms requestId=${requestId}`);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }
    
  } catch {
    const duration = Date.now() - startTime;
    console.log(`[transcribe] status=500 error duration=${duration}ms requestId=${requestId}`);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
} 
