import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Fraunces, Permanent_Marker, Caveat } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
})

const fraunces = Fraunces({ 
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const permanentMarker = Permanent_Marker({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-permanent-marker',
  display: 'swap',
})

const caveat = Caveat({ 
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Crazy Sapiens | Psychological Research Platform',
  description: 'A psychological research platform created through the consistent and creative intellectual efforts of Pradipta Poddar, Nandani Sharma, and Yasar Syed.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2D6A4F',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html 
      lang="en" 
      className={`${plusJakartaSans.variable} ${fraunces.variable} ${permanentMarker.variable} ${caveat.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
