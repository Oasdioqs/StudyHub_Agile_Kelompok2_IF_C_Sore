'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

function PostHogIdentify() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user?.id || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    // Sanitize user data before sending to PostHog
    const sanitizedEmail = String(session.user.email || '').trim().toLowerCase()
    const sanitizedName = String(session.user.name || '').trim().slice(0, 100)

    posthog.identify(session.user.id, {
      email: sanitizedEmail,
      name: sanitizedName,
      isPremium: (session.user as any).isPremium,
    })
  }, [session])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false, // manual tracking for control
      persistence: 'localStorage',
      // Security: Disable remote config fetch to prevent configuration injection
      bootstrap: {},
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug()
      },
    })
  }, [])

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  )
}
