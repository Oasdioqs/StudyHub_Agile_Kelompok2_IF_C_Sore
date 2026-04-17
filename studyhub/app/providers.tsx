'use client'

import { SessionProvider } from 'next-auth/react'
import { useFCM } from '@/hooks/useFCM'
import { PostHogProvider } from '@/components/PostHogProvider'

function FCMProvider({ children }: { children: React.ReactNode }) {
  useFCM()
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <FCMProvider>{children}</FCMProvider>
      </PostHogProvider>
    </SessionProvider>
  )
}
