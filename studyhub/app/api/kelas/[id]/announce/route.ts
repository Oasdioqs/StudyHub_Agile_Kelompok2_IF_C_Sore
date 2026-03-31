import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendPushToTokens } from '@/lib/firebase-admin'

// POST: komisaris kirim pengumuman ke semua anggota
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id, role: 'ADMIN' },
  })
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat kirim pengumuman' }, { status: 403 })

  const body = await req.json()
  const { title, message } = body
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Judul dan pesan wajib diisi' }, { status: 400 })
  }

  const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
  const members = await db.groupMember.findMany({
    where: { groupId: params.id, NOT: { userId: session.user.id } },
  })

  // Simpan ke tabel ClassAnnouncement (bisa dibaca semua anggota di tab Pengumuman)
  const announcement = await db.classAnnouncement.create({
    data: {
      groupId: params.id,
      title: title.trim(),
      message: message.trim(),
      createdById: session.user.id,
    },
  })

  // Kirim notif ke semua anggota (kecuali pengirim)
  if (members.length > 0) {
    const memberIds = members.map((m) => m.userId)

    // 1. Notifikasi database (in-app)
    await db.notification.createMany({
      data: memberIds.map((userId) => ({
        userId,
        type: 'CLASS_ANNOUNCEMENT',
        title: `📢 ${title.trim()} — ${group?.name}`,
        message: message.trim(),
        link: `/kelas/${params.id}?tab=announcements`,
      })),
    })

    // 2. FCM push notification (real-time)
    try {
      const fcmTokens = await db.fcmToken.findMany({
        where: { userId: { in: memberIds } },
        select: { token: true },
      })
      const tokens = fcmTokens.map((t) => t.token)
      if (tokens.length > 0) {
        await sendPushToTokens(tokens, {
          title: `📢 ${title.trim()} — ${group?.name}`,
          body: message.trim().length > 100 ? message.trim().slice(0, 97) + '…' : message.trim(),
          url: `/kelas/${params.id}?tab=announcements`,
        })
      }
    } catch (err) {
      // Jangan gagalkan request jika FCM bermasalah
      console.error('[FCM] Announce push error:', err)
    }
  }

  return NextResponse.json({ ok: true, sent: members.length, announcement })
}
