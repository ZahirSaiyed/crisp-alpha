import { createClient } from "@deepgram/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const alt = result?.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alt?.transcript;
    const words = alt?.words || [];
    return NextResponse.json({ transcript: transcript || "No speech detected", words });
    
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" }, 
      { status: 500 }
    );
  }
} 