import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken as getMessagingToken, onMessage, type Messaging } from 'firebase/messaging'

// Firebase config from environment variables (all are public-safe, used client-side)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

// Only initialize if config is available
const app = getApps().length > 0 ? getApp() : (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null)
export const firebaseApp = app

// Initialize Firebase App Check for additional security
// This helps protect Firebase resources from abuse
// NOTE: App Check is disabled for now - requires reCAPTCHA Enterprise setup
// To enable: add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to environment variables
let appCheckInitialized = false

export function initializeFirebaseAppCheck() {
  // App Check is disabled - uncomment and configure if needed
  // const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  // if (recaptchaSiteKey) { ... }
  return
}

let messagingInstance: Messaging | null = null

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!firebaseApp) return null

  // Initialize App Check on first use
  initializeFirebaseAppCheck()

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

    const token = await getMessagingToken(messaging, {
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
