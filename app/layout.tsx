import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Archivo, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

/* Display — a wonky, warm, slightly cocky grotesque. The voice: wordmark,
   page titles, and the questions participants read. */
const bricolage = Bricolage_Grotesque({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

/* Body / UI — a precise grotesque doing the honest labour: labels, tables, buttons. */
const archivo = Archivo({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

/* Data — every score, D-value, reaction time and participant ID. The ledger. */
const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
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
  themeColor: '#CE2029',
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
      suppressHydrationWarning
      className={`${bricolage.variable} ${archivo.variable} ${spaceMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* Skip to main content — accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
          >
            Skip to main content
          </a>
          {children}
          <Toaster position="bottom-right" richColors />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
