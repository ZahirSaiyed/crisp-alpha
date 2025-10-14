import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppHeader from '../components/AppHeader'

// Optimize Inter font with subset and display swap
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Crisp - Turn shaky moments into sharp delivery',
  description: 'Practice speaking with instant feedback and insights that help you sound as clear as you think. Perfect for interviews, presentations, and public speaking.',
  keywords: ['public speaking', 'interview prep', 'presentation skills', 'speech practice', 'communication'],
  authors: [{ name: 'Crisp' }],
  creator: 'Crisp',
  publisher: 'Crisp',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://crisp.up.railway.app',
    siteName: 'Crisp',
    title: 'Crisp - Turn shaky moments into sharp delivery',
    description: 'Practice speaking with instant feedback and insights that help you sound as clear as you think. Perfect for interviews, presentations, and public speaking.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Crisp - Practice speaking with instant feedback',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crisp - Turn shaky moments into sharp delivery',
    description: 'Practice speaking with instant feedback and insights that help you sound as clear as you think.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <AppHeader />
        {children}
      </body>
    </html>
  )
}