import { NextRequest } from 'next/server'

// Simple in-memory rate limiter (replace with Redis/Upstash for multi-instance)
const rateLimitMap = new Map<string, number[]>()
const promptRateLimitMap = new Map<string, number[]>() // Separate bucket for prompt generation
const MAX_REQUESTS = 20
const MAX_PROMPT_REQUESTS = 15 // Slightly lower for prompt generation
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  
  return 'unknown'
}

export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const requests = rateLimitMap.get(ip) || []
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_MS)
  
  if (validRequests.length >= MAX_REQUESTS) {
    return true
  }
  
  // Add current request
  validRequests.push(now)
  rateLimitMap.set(ip, validRequests)
  
  return false
}

export function getRateLimitInfo(ip: string): { remaining: number; resetTime: number } {
  const now = Date.now()
  const requests = rateLimitMap.get(ip) || []
  const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_MS)
  
  return {
    remaining: Math.max(0, MAX_REQUESTS - validRequests.length),
    resetTime: validRequests.length > 0 ? (validRequests[0] ?? now) + WINDOW_MS : now + WINDOW_MS,
  }
}

// Separate rate limiter for prompt generation endpoint
export function isPromptRateLimited(ip: string): boolean {
  const now = Date.now()
  const requests = promptRateLimitMap.get(ip) || []
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_MS)
  
  if (validRequests.length >= MAX_PROMPT_REQUESTS) {
    return true
  }
  
  // Add current request
  validRequests.push(now)
  promptRateLimitMap.set(ip, validRequests)
  
  return false
}

export function getPromptRateLimitInfo(ip: string): { remaining: number; resetTime: number } {
  const now = Date.now()
  const requests = promptRateLimitMap.get(ip) || []
  const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_MS)
  
  return {
    remaining: Math.max(0, MAX_PROMPT_REQUESTS - validRequests.length),
    resetTime: validRequests.length > 0 ? (validRequests[0] ?? now) + WINDOW_MS : now + WINDOW_MS,
  }
}
