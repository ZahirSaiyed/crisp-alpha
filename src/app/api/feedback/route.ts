import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { ENV, GEMINI_MODEL } from '../../../lib/env'
import {
  badRequest,
  serverError,
  tooManyRequests,
} from '../../../lib/http'
import { logApiCall, logError } from '../../../lib/log'
import { getRequestId } from '../../../lib/context'
import { getClientIP, isPromptRateLimited } from '../../../lib/rateLimit'

export const runtime = 'nodejs'

const TokenSchema = z.object({
  word: z.string(),
  start: z.number().optional(),
  end: z.number().optional(),
})

const FeedbackRequestSchema = z.object({
  tokens: z.array(TokenSchema).optional(),
  transcript: z.string().optional(),
  maxWords: z.number().optional(),
})

function buildTranscript(tokens: z.infer<typeof TokenSchema>[], maxWords?: number): string {
  const words = tokens.map((t) => t.word)
  const limited = maxWords ? words.slice(0, maxWords) : words
  return limited.join(' ')
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId() || 'unknown'
  const startTime = Date.now()

  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return badRequest('Expected application/json', 'INVALID_CONTENT_TYPE', requestId)
    }

    const body = await req.json()
    const parsed = FeedbackRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      return badRequest(`Validation failed: ${issues}`, 'VALIDATION_ERROR', requestId)
    }

    const { tokens, transcript: rawTranscript, maxWords } = parsed.data

    const transcript =
      typeof rawTranscript === 'string' && rawTranscript.trim().length > 0
        ? rawTranscript
        : tokens && tokens.length > 0
        ? buildTranscript(tokens, maxWords)
        : null

    if (!transcript) {
      return badRequest('Provide tokens or transcript', 'MISSING_CONTENT', requestId)
    }

    const ip = getClientIP(req)
    if (isPromptRateLimited(ip)) {
      logApiCall('FeedbackGeneration', 'rate_limited', 429, Date.now() - startTime, requestId)
      return tooManyRequests('Too many requests', 'RATE_LIMITED', requestId)
    }

    const prompt = `You are a communication coach reviewing a speaking practice session.

Transcript:
"""
${transcript}
"""

Write your feedback in exactly this format — no JSON, no markdown headers, no extra commentary:

Strengths:
- [one clear strength]
- [another strength]
- [another strength]

Weaknesses:
- [one weakness]
- [another weakness]

Recommendations:
- [specific, actionable recommendation]
- [another recommendation]
- [another recommendation]

Each item is a single concise sentence. Write naturally — the speaker will read this directly. Focus on communication patterns, clarity, pacing, and confidence.`

    const controller = new AbortController()

    try {
      const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY })
      const streamResult = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt,
      })

      logApiCall('Gemini', GEMINI_MODEL, 200, Date.now() - startTime, requestId)

      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        async start(streamController) {
          const timeoutId = setTimeout(() => {
            controller.abort()
            try { streamController.close() } catch {}
          }, 20000)

          try {
            for await (const chunk of streamResult) {
              if (controller.signal.aborted) break
              const text = chunk.text || ''
              if (text) streamController.enqueue(encoder.encode(text))
            }
          } catch (streamError) {
            if (!(streamError instanceof Error && streamError.name === 'AbortError')) {
              logError('Gemini stream error', {
                error: streamError instanceof Error ? streamError.message : 'Unknown',
                requestId,
              })
            }
          } finally {
            clearTimeout(timeoutId)
            try { streamController.close() } catch {}
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Request-ID': requestId,
          'Cache-Control': 'no-cache',
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof Error && error.name === 'AbortError') {
        logApiCall('Gemini', 'timeout', 408, duration, requestId, { error: 'Request timeout' })
      } else {
        logError('Gemini feedback API error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
          requestId,
        })
      }

      return serverError('Feedback generation failed', 'GEMINI_ERROR', requestId)
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logError('Feedback endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    })
    return serverError('Feedback generation failed', 'INTERNAL_ERROR', requestId)
  }
}
