import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/footer'
import { Toaster } from "@/components/ui/toaster"
import ErrorBoundary from '@/components/error-boundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Mabu Apartments',
    template: '%s | Mabu Apartments',
  },
  description: 'Luxury apartments for your stay in Abuja',
  applicationName: 'Mabu Apartments',
  openGraph: {
    title: 'Mabu Apartments',
    description: 'Luxury apartments for your stay in Abuja',
    type: 'website',
    siteName: 'Mabu Apartments',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mabu Apartments',
    description: 'Luxury apartments for your stay in Abuja',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon-32x32.png'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <Header />
          <main>{children}</main>
          <Footer />
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  )
}
