import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
  
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
    ];
  },
};

export default nextConfig;


