import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, badRequest, serverError } from '../../../../lib/http'
import { logError } from '../../../../lib/log'
import { getRequestId } from '../../../../lib/context'

// Zod schemas for validation
const CoachStatusSchema = z.object({
  status: z.enum(['pending', 'ready', 'error']),
  coach: z.unknown().optional(),
})

const CoachResponseSchema = z.object({
  status: z.enum(['pending', 'ready', 'error']),
  coach: z.unknown().optional(),
})

// Placeholder in-memory store to simulate Redis-backed coach status
const mem = new Map<string, { status: 'pending'|'ready'|'error'; coach?: unknown }>()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId() || 'unknown'
  
  try {
    const resolvedParams = await params
    const id = String(resolvedParams?.id || '')
    
    if (!id || id.trim().length === 0) {
      logError('Missing coach ID', { requestId })
      return badRequest('Missing coach ID', 'MISSING_ID', requestId)
    }
    
    const val = mem.get(id) || { status: 'pending' as const }
    
    const validation = CoachResponseSchema.safeParse(val)
    if (!validation.success) {
      logError('Invalid coach status data', { errors: validation.error.issues, requestId })
      return serverError('Invalid coach status', 'INVALID_STATUS', requestId)
    }
    
    const response = new Response(JSON.stringify(validation.data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
    })
    
    return response
    
  } catch (error) {
    logError('Coach endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      requestId 
    })
    return serverError('Failed to get coach status', 'INTERNAL_ERROR', requestId)
  }
}


