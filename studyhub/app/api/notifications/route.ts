import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const NO_CACHE = { 'Cache-Control': 'no-store, max-age=0' }

// GET: ambil notifikasi
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const unreadCount = notifications.reduce((acc, n) => (n.isRead ? acc : acc + 1), 0)
    return NextResponse.json({ notifications, unreadCount }, { headers: NO_CACHE })
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { headers: NO_CACHE })
  }
}

// PATCH: tandai baca (id tertentu atau semua)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body

  try {
    if (id) {
      await db.notification.update({ where: { id, userId: session.user.id }, data: { isRead: true } })
    } else {
      await db.notification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } })
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE: hapus notifikasi (id tertentu atau semua)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body

  try {
    if (id) {
      await db.notification.delete({ where: { id, userId: session.user.id } })
    } else {
      await db.notification.deleteMany({ where: { userId: session.user.id } })
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
