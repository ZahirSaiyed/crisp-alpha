import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Use SWC minifier for better performance
  swcMinify: true,
  
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
  
  // Experimental features for better performance
  experimental: {
    // Enable server components logging in development
    serverComponentsExternalPackages: [],
  },
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // Security headers as fallback (middleware handles most cases)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ]
  },
}

export default nextConfig


