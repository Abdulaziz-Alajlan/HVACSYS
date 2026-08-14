import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AirWise | AI-Driven HVAC Optimization',
  description: 'Smart building HVAC optimization platform with AI-powered zone control, energy analytics, and predictive maintenance',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/logo-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/logo-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f141b',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
