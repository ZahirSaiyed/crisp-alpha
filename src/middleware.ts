import { NextRequest, NextResponse } from 'next/server'
import { createRequestId, withRequestId } from './lib/context'
import { getClientIP, isRateLimited, getRateLimitInfo } from './lib/rateLimit'
import { logRequest } from './lib/log'
import { ENV, IS_PROD } from './lib/env'

// CSP configuration
const CSP_CONFIG = {
  development: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js HMR requires unsafe-eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ],
  production: [
    "default-src 'self'",
    "script-src 'self'", // No unsafe-* in production
    "style-src 'self' 'unsafe-inline'", // Still needed for Tailwind
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ]
}

export function middleware(request: NextRequest) {
  const startTime = Date.now()
  const requestId = createRequestId()
  const { pathname } = request.nextUrl
  const method = request.method
  
  return withRequestId(requestId, () => {
    // Origin validation for API routes
    if (pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin')
      if (origin && origin !== ENV.NEXT_PUBLIC_BASE_URL) {
        const response = new NextResponse('Forbidden', { status: 403 })
        response.headers.set('X-Request-ID', requestId)
        
        logRequest(method, pathname, 403, Date.now() - startTime, requestId, {
          reason: 'origin_mismatch',
          origin,
          expected: ENV.NEXT_PUBLIC_BASE_URL
        })
        
        return response
      }
      
      // Rate limiting
      const ip = getClientIP(request)
      if (isRateLimited(ip)) {
        const rateLimitInfo = getRateLimitInfo(ip)
        const response = new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': '600', // 10 minutes
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString(),
          },
        })
        response.headers.set('X-Request-ID', requestId)
        
        logRequest(method, pathname, 429, Date.now() - startTime, requestId, {
          reason: 'rate_limited',
          ip,
          remaining: rateLimitInfo.remaining
        })
        
        return response
      }
    }
    
    // Create response with security headers
    const response = NextResponse.next()
    
    // Request ID header
    response.headers.set('X-Request-ID', requestId)
    
    // Security headers
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Frame-Options', 'DENY')
    
    // Environment-aware CSP
    const cspDirectives = IS_PROD ? CSP_CONFIG.production : CSP_CONFIG.development
    response.headers.set('Content-Security-Policy', cspDirectives.join('; '))
    
    // Log the request
    const duration = Date.now() - startTime
    logRequest(method, pathname, 200, duration, requestId)
    
    return response
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
