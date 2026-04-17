import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/styles/globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
})

const APP_URL = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'StudyHub — Platform Belajar Kolaboratif',
    template: '%s | StudyHub',
  },
  description: 'Platform belajar terpadu dengan AI Tutor, manajemen tugas, kelas virtual, forum diskusi, dan flashcard untuk pelajar dan mahasiswa.',
  keywords: ['belajar', 'kuliah', 'tugas', 'flashcard', 'AI tutor', 'catatan', 'mahasiswa', 'edukasi'],
  authors: [{ name: 'StudyHub Team' }],
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: APP_URL,
    siteName: 'StudyHub',
    title: 'StudyHub — Platform Belajar Kolaboratif',
    description: 'Platform belajar terpadu dengan AI Tutor, manajemen tugas, dan kelas virtual untuk mahasiswa Indonesia.',
    images: [{ url: '/icons/icon-192.png', width: 192, height: 192, alt: 'StudyHub' }],
  },
  twitter: {
    card: 'summary',
    title: 'StudyHub',
    description: 'Platform belajar terpadu untuk mahasiswa Indonesia.',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/favicon.ico' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/icons/favicon.ico',
  },
  manifest: '/manifest.json',
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
