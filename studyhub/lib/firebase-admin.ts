import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK (singleton, lazy)
function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !rawKey) {
    console.warn('[Firebase Admin] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY')
    return null
  }

  // Vercel menyimpan private key dengan literal \n — ganti jadi newline
  const privateKey = rawKey.replace(/\\n/g, '\n')

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, privateKey, clientEmail } as admin.ServiceAccount),
    })
  } catch (err) {
    console.error('[Firebase Admin] Init error:', err)
    return null
  }
}

let _app: admin.app.App | null | undefined
function ensureApp() {
  if (_app === undefined) _app = getFirebaseAdmin()
  return _app
}

/**
 * Kirim push notification ke satu device token
 */
export async function sendPushToToken(
  token: string,
  payload: { title: string; body: string; url?: string }
) {
  const app = ensureApp()
  if (!app) {
    console.warn('[FCM] Firebase not initialized, skipping push')
    return false
  }

  try {
    const messaging = admin.messaging(app)
    await messaging.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: { link: payload.url ?? '/' },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
        },
      },
      android: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: 'ic_notification',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
      },
    })
    console.log('[FCM] Push sent to token:', token.slice(0, 20) + '...')
    return true
  } catch (err: any) {
    // Token invalid/expired → cleanup
    if (err?.code === 'messaging/registration-token-not-registered' ||
        err?.code === 'messaging/invalid-registration-token') {
      console.warn('[FCM] Invalid token, cleaning up:', token.slice(0, 20))
      try {
        const { db } = await import('@/lib/db')
        await db.fcmToken.deleteMany({ where: { token } })
      } catch {}
    } else {
      console.error('[FCM] Failed to send:', err?.code || err?.message || err)
    }
    return false
  }
}

/**
 * Kirim push notification ke banyak tokens sekaligus (batch max 500)
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: { title: string; body: string; url?: string }
) {
  if (tokens.length === 0) return
  const app = ensureApp()
  if (!app) {
    console.warn('[FCM] Firebase not initialized, skipping batch push')
    return
  }

  const messaging = admin.messaging(app)
  const chunks: string[][] = []
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500))
  }

  for (const chunk of chunks) {
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        webpush: {
          fcmOptions: { link: payload.url ?? '/' },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
          },
        },
        android: {
          priority: 'high',
          notification: {
            title: payload.title,
            body: payload.body,
            icon: 'ic_notification',
          },
        },
      })
      console.log(`[FCM] Batch: ${result.successCount} sent, ${result.failureCount} failed`)

      // Cleanup invalid tokens
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          import('@/lib/db').then(({ db }) =>
            db.fcmToken.deleteMany({ where: { token: chunk[idx] } })
          ).catch(() => {})
        }
      })
    } catch (err) {
      console.error('[FCM] Batch send error:', err)
    }
  }
}
