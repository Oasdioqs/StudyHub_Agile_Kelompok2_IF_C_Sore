import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendPushToToken } from '@/lib/firebase-admin'

// GET: test FCM push — kirim push ke device user sendiri
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ambil tokens user ini
  const tokens = await db.fcmToken.findMany({
    where: { userId: session.user.id },
    select: { token: true, platform: true, createdAt: true },
  })

  if (tokens.length === 0) {
    return NextResponse.json({
      error: 'Tidak ada FCM token tersimpan. Pastikan browser mengizinkan notifikasi.',
      debug: { userId: session.user.id, tokenCount: 0 },
    })
  }

  // Coba kirim ke semua token user
  const results = []
  for (const t of tokens) {
    const success = await sendPushToToken(t.token, {
      title: '🔔 Test Push Notification',
      body: 'Ini adalah test notifikasi dari StudyHub. Jika kamu melihat ini, FCM berhasil!',
      url: '/calendar',
    })
    results.push({
      tokenPrefix: t.token.slice(0, 20) + '...',
      platform: t.platform,
      success,
    })
  }

  return NextResponse.json({
    message: 'Test push selesai',
    tokenCount: tokens.length,
    results,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING',
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? `SET (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'MISSING',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? 'SET' : 'MISSING',
  })
}
