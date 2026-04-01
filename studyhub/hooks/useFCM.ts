'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { requestAndRegisterToken, onForegroundMessage } from '@/lib/firebase-client'

/**
 * Hook yang:
 * 1. Minta izin notifikasi saat user login
 * 2. Daftar FCM token ke server
 * 3. Handle foreground messages (tampil sebagai browser Notification)
 * 4. Dispatch event agar bell badge langsung update saat FCM masuk
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

      // Listen foreground messages — tampilkan sebagai browser Notification via Service Worker
      onForegroundMessage(async (payload) => {
        const title = payload.notification?.title || 'StudyHub'
        const body = payload.notification?.body || ''
        const url = (payload as any).fcmOptions?.link || (payload as any).data?.url || '/'
        if (Notification.permission === 'granted') {
          try {
            const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
            if (swReg) {
              swReg.showNotification(title, {
                body,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                data: { url },
                tag: 'studyhub-fg-' + Date.now(),
              } as NotificationOptions)
            } else {
              const n = new Notification(title, {
                body,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
              })
              n.onclick = () => {
                window.focus()
                window.location.href = url
              }
            }
          } catch {
            const n = new Notification(title, { body, icon: '/icons/icon-192.png' })
            n.onclick = () => { window.focus(); window.location.href = url }
          }
        }

        // ★ Dispatch event agar bell badge di Topbar langsung refresh
        window.dispatchEvent(new CustomEvent('studyhub:new-notification'))
      })
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [status, session?.user?.id])
}
