import { NextRequest } from 'next/server'

// Simple in-memory rate limiter (replace with Redis/Upstash for multi-instance)
const rateLimitMap = new Map<string, number[]>()
const MAX_REQUESTS = 20
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
