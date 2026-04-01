'use client'

import { SessionProvider } from 'next-auth/react'
import { useFCM } from '@/hooks/useFCM'

function FCMProvider({ children }: { children: React.ReactNode }) {
  useFCM()
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FCMProvider>{children}</FCMProvider>
    </SessionProvider>
  )
}
