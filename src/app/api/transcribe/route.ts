import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ENV, USE_FIXTURE } from '../../../lib/env'
import { 
  badRequest, 
  entityTooLarge, 
  gatewayTimeout, 
  serverError, 
  ok,
} from '../../../lib/http'
import { logApiCall, logError } from '../../../lib/log'
import { getRequestId } from '../../../lib/context'

export const runtime = 'nodejs'

// Disable body parser to handle streaming with size limits
export const config = {
  api: {
    bodyParser: false,
  },
}

// Zod schemas for validation
const AllowedMimeTypes = z.enum(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav'])

// Request schema unused currently (header validation handled inline)

const TranscribeResponseSchema = z.object({
  transcript: z.string(),
  words: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
  })),
  paragraphs: z.array(z.object({
    text: z.string(),
    start: z.number().optional(),
    end: z.number().optional(),
  })),
  source: z.enum(['live', 'fixture']),
})

// Type definitions
type DeepgramWord = { word?: string; start?: number; end?: number; confidence?: number }
type DeepgramAlternative = { transcript?: string; words?: DeepgramWord[] }
type DeepgramResult = {
  results?: {
    channels?: Array<{
      alternatives?: DeepgramAlternative[]
    }>
  }
}

type Paragraph = { text?: string; start?: number; end?: number }

type DgSentence = { text?: string; start?: number; end?: number }
type DgParagraph = { sentences?: DgSentence[] }
type DgParagraphs = { paragraphs?: DgParagraph[] }

type DeepgramAlternativeWithParagraphs = DeepgramAlternative & { paragraphs?: DgParagraphs }

function mapParagraphs(alt: DeepgramAlternativeWithParagraphs | undefined): Paragraph[] {
  const out: Paragraph[] = [];
  const paras = alt?.paragraphs?.paragraphs;
  if (Array.isArray(paras)) {
    for (const p of paras) {
      const sents = Array.isArray(p?.sentences) ? p.sentences : [];
      if (sents.length > 0) {
        const text = sents.map((s) => (typeof s?.text === "string" ? s.text : "")).join(" ").trim();
        const first = sents[0]!; // safe due to length check above
        const last = sents[sents.length - 1]!; // safe due to length check above
        const para: Paragraph = { text };
        if (typeof first?.start === "number") {
          para.start = first.start;
        }
        if (typeof last?.end === "number") {
          para.end = last.end;
        }
        out.push(para);
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
  const requestId = getRequestId() || 'unknown'
  const startTime = Date.now()
  
  try {
    // Note: Header validation removed to avoid blocking legitimate requests
    // The core validation happens on the actual audio data below

    // Security: Check content type (allow multipart/form-data for FormData uploads)
    const contentType = request.headers.get('content-type') || ''
    const isFormData = contentType.includes('multipart/form-data')
    
    // Validate MIME type for non-FormData uploads
    if (!isFormData) {
      const baseType = contentType.split(';')[0]?.trim()
      const mimeValidation = AllowedMimeTypes.safeParse(baseType)
      if (!mimeValidation.success) {
        logError('Invalid MIME type', { contentType, requestId })
        return badRequest('Invalid audio format', 'INVALID_MIME_TYPE', requestId)
      }
    }

    // If fixture mode is on (dev only), return the saved JSON from disk
    if (USE_FIXTURE) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const filePath = path.resolve(process.cwd(), 'src/fixtures/transcript.json')
        if (!fs.existsSync(filePath)) {
          logError('Fixture file not found', { filePath, requestId })
          return serverError('Fixture not found. Add src/fixtures/transcript.json', 'FIXTURE_NOT_FOUND', requestId)
        }
        const txt = fs.readFileSync(filePath, 'utf8')
        const json = JSON.parse(txt) as DeepgramResult
        const alt = json?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined
        const transcript = alt?.transcript ?? 'No speech detected'
        const words = alt?.words ?? []
        const paragraphs: Paragraph[] = mapParagraphs(alt)
        
        const response = { transcript, words, paragraphs, source: 'fixture' as const }
        const validation = TranscribeResponseSchema.safeParse(response)
        if (!validation.success) {
          logError('Fixture response validation failed', { errors: validation.error.issues, requestId })
          return serverError('Invalid fixture data', 'FIXTURE_VALIDATION_ERROR', requestId)
        }
        
        return ok(response, requestId)
      } catch (error) {
        logError('Failed to load fixture', { error: error instanceof Error ? error.message : 'Unknown error', requestId })
        return serverError('Failed to load fixture', 'FIXTURE_LOAD_ERROR', requestId)
      }
    }

    let audioBuffer: Buffer
    let fileMime: string | undefined

    if (isFormData) {
      // Handle FormData upload
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File
      
      if (!audioFile) {
        logError('No audio file provided', { requestId })
        return badRequest('No audio file provided', 'NO_AUDIO_FILE', requestId)
      }

      // Check file size
      if (audioFile.size > 20 * 1024 * 1024) { // 20MB
        logError('File too large', { size: audioFile.size, requestId })
        return entityTooLarge('File too large', 'FILE_TOO_LARGE', requestId)
      }

      // Validate MIME type
      const fileType = audioFile.type
      const mimeValidation = AllowedMimeTypes.safeParse(fileType.split(';')[0]?.trim())
      if (!mimeValidation.success) {
        logError('Invalid file MIME type', { fileType, requestId })
        return badRequest('Invalid audio format', 'INVALID_FILE_MIME', requestId)
      }

      audioBuffer = Buffer.from(await audioFile.arrayBuffer())
      fileMime = normalizeMime(fileType)
    } else {
      // Handle direct binary upload
      const chunks: Buffer[] = []
      let size = 0
      const MAX_SIZE = 20 * 1024 * 1024 // 20MB
      
      const reader = request.body?.getReader()
      if (!reader) {
        logError('No request body', { requestId })
        return badRequest('No audio data provided', 'NO_BODY', requestId)
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          size += value.length
          if (size > MAX_SIZE) {
            logError('Request body too large', { size, requestId })
            return entityTooLarge('File too large', 'BODY_TOO_LARGE', requestId)
          }
          
          chunks.push(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }

      audioBuffer = Buffer.concat(chunks)
      fileMime = normalizeMime(contentType)
    }
    
    // Create Deepgram client with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25s timeout
    
    try {
      const deepgramUrl = 'https://api.deepgram.com/v1/listen?smart_format=true&filler_words=true&paragraphs=true&model=nova-2&language=en&detect_language=false'
      
      const resp = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${ENV.DEEPGRAM_API_KEY}`,
          'Content-Type': (fileMime || 'audio/webm') as string,
        },
        body: audioBuffer as BodyInit,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!resp.ok) {
        const errorText = await resp.text()
        logApiCall('Deepgram', deepgramUrl, resp.status, Date.now() - startTime, requestId, {
          error: `HTTP ${resp.status}`,
          response: errorText,
        })
        return serverError(`Transcription service unavailable: ${resp.status} ${errorText}`, 'DEEPGRAM_ERROR', requestId)
      }
      
      const result = await resp.json()

      const dg = result as unknown as DeepgramResult
      const alt = dg?.results?.channels?.[0]?.alternatives?.[0] as DeepgramAlternativeWithParagraphs | undefined
      const transcript = alt?.transcript ?? 'No speech detected'
      const words = alt?.words ?? []
      const paragraphs: Paragraph[] = mapParagraphs(alt)
      
      const duration = Date.now() - startTime
      logApiCall('Deepgram', deepgramUrl, 200, duration, requestId)
      
      // Immediately free the audio buffer
      audioBuffer.fill(0)
      
      const response = { 
        transcript, 
        words, 
        paragraphs, 
        source: 'live' as const 
      }
      
      const validation = TranscribeResponseSchema.safeParse(response)
      if (!validation.success) {
        logError('Response validation failed', { errors: validation.error.issues, requestId })
        return serverError('Invalid response format', 'RESPONSE_VALIDATION_ERROR', requestId)
      }
      
      return ok(response, requestId)
      
    } catch (error) {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      if (error instanceof Error && error.name === 'AbortError') {
        logApiCall('Deepgram', 'timeout', 408, duration, requestId, { error: 'Request timeout' })
        return gatewayTimeout('Request timeout', 'DEEPGRAM_TIMEOUT', requestId)
      }
      
      logError('Deepgram API error', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        duration, 
        requestId 
      })
      return serverError('Transcription failed', 'DEEPGRAM_ERROR', requestId)
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    logError('Transcribe endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      duration, 
      requestId 
    })
    return serverError('Transcription failed', 'INTERNAL_ERROR', requestId)
  }
} 
