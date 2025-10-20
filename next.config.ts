import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
  
  // External packages for server components
  serverExternalPackages: [],
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // Security headers as fallback (middleware handles most cases)
  async headers() {
    return [
      // Allow public assets (OG images, robots.txt, etc.) to be accessed without restrictions
      {
        source: '/:path(og-image.png|robots.txt|favicon.ico|icon.svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Apply security headers to all other routes
      {
        source: '/((?!og-image.png|robots.txt|favicon.ico|icon.svg).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Changed from DENY to SAMEORIGIN for better compatibility
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // Changed to allow social media crawlers
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://us.i.posthog.com",
              "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig


