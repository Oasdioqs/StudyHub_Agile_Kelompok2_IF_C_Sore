'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { requestAndRegisterToken, onForegroundMessage } from '@/lib/firebase-client'

/**
 * Hook yang:
 * 1. Minta izin notifikasi saat user login
 * 2. Daftar FCM token ke server
 * 3. Handle foreground messages (tampil sebagai toast/notif in-app)
 */
export function useFCM() {
  const { data: session, status } = useSession()
  const registeredRef = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || registeredRef.current) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (!('serviceWorker' in navigator)) return

    registeredRef.current = true

    // Delay sedikit agar tidak blokir initial render
    const timer = setTimeout(async () => {
      await requestAndRegisterToken()

      // Listen foreground messages — tampilkan sebagai browser Notification
      onForegroundMessage((payload) => {
        const title = payload.notification?.title || 'StudyHub'
        const body = payload.notification?.body || ''
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
          })
        }
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [status, session?.user?.id])
}
