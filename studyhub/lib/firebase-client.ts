import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyCNBD6ujsem9MB6As7--wFeRNjAcWTz1sY",
  authDomain: "studyhub-8e93e.firebaseapp.com",
  projectId: "studyhub-8e93e",
  storageBucket: "studyhub-8e93e.firebasestorage.app",
  messagingSenderId: "108950489599",
  appId: "1:108950489599:web:d7ee5cf24a2de199973fca",
}

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

let messagingInstance: Messaging | null = null

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp)
  }
  return messagingInstance
}

/**
 * Request notification permission & get FCM token.
 * Registers with service worker, then saves token to server.
 * Returns token string, or null if permission denied.
 */
export async function requestAndRegisterToken(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied')
      return null
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = getFirebaseMessaging()
    if (!messaging) return null

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (token) {
      // Simpan token ke server
      await fetch('/api/user/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'web' }),
      })
      console.log('[FCM] Token registered:', token.slice(0, 20) + '...')
    }

    return token
  } catch (err) {
    console.error('[FCM] Error getting token:', err)
    return null
  }
}

/**
 * Handle foreground messages (app is open/focused)
 * Callback menerima payload notifikasi
 */
export function onForegroundMessage(callback: (payload: {
  notification?: { title?: string; body?: string }
  data?: Record<string, string>
}) => void) {
  const messaging = getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
