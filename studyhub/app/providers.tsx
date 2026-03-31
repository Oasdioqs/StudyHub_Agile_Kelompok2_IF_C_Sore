'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initApp = async () => {
      if (typeof window !== 'undefined') {
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar')
          await StatusBar.setStyle({ style: Style.Dark })
          await StatusBar.setBackgroundColor({ color: '#4f46e5' })
        } catch (e) {
          // not running in native container
        }
      }
    }
    initApp()
  }, [])

  return <SessionProvider>{children}</SessionProvider>
}
