import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST: simpan/update FCM token untuk device ini
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, platform } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  // Upsert token — jika token sudah ada, update userId-nya (misal user ganti akun di device yang sama)
  await db.fcmToken.upsert({
    where: { token },
    create: { userId: session.user.id, token, platform: platform ?? 'web' },
    update: { userId: session.user.id, updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

// DELETE: hapus FCM token saat logout
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  await db.fcmToken.deleteMany({
    where: { token, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
