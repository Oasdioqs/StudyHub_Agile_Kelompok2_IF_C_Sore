// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/styles/globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StudyHub — Platform Belajar Kolaboratif',
  description: 'Platform belajar terpadu untuk pelajar dan mahasiswa Indonesia',
  icons: { icon: '/icons/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
