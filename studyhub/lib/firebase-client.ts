import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken as getMessagingToken, onMessage, type Messaging } from 'firebase/messaging'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckToken } from '@firebase/app-check'

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
let appCheckInitialized = false

export function initializeFirebaseAppCheck() {
  if (typeof window === 'undefined' || !firebaseApp || appCheckInitialized) return

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!recaptchaSiteKey) {
    console.warn('[Firebase] App Check disabled: NEXT_PUBLIC_RECAPTCHA_SITE_KEY not set')
    return
  }

  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
    appCheckInitialized = true
    console.log('[Firebase] App Check initialized')
  } catch (err) {
    console.error('[Firebase] App Check initialization failed:', err)
  }
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
