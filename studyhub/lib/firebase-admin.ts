import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK (singleton)
function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app()

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  })
}

export const firebaseAdmin = getFirebaseAdmin()
export const fcmMessaging = admin.messaging()

/**
 * Kirim push notification ke satu device token
 */
export async function sendPushToToken(
  token: string,
  payload: { title: string; body: string; url?: string }
) {
  try {
    await fcmMessaging.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: payload.url
        ? {
            fcmOptions: { link: payload.url },
            notification: {
              title: payload.title,
              body: payload.body,
              icon: '/icons/icon-192.png',
              badge: '/icons/badge-72.png',
            },
          }
        : undefined,
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
    return true
  } catch (err) {
    console.error('[FCM] Failed to send to token:', err)
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

  const chunks: string[][] = []
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500))
  }

  for (const chunk of chunks) {
    try {
      await fcmMessaging.sendEachForMulticast({
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
    } catch (err) {
      console.error('[FCM] Batch send error:', err)
    }
  }
}
