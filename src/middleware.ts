import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter (replace with Redis/Upstash for multi-instance)
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS = 20;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_MS);
  
  if (validRequests.length >= MAX_REQUESTS) {
    return true;
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Apply rate limiting only to API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request);
    
    if (isRateLimited(ip)) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': '600', // 10 minutes
        },
      });
    }
  }
  
  // Security headers for all responses
  const response = NextResponse.next();
  
  // HSTS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  
  // Content type sniffing protection
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'no-referrer');
  
  // Frame options
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval for HMR
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "media-src 'self' blob:",
      "connect-src 'self'", // No external connects from client
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ')
  );
  
  return response;
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
