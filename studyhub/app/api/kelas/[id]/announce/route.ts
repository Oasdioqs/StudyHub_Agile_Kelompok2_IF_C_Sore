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

  // Simpan ke tabel ClassAnnouncement
  const announcement = await db.classAnnouncement.create({
    data: {
      groupId: params.id,
      title: title.trim(),
      message: message.trim(),
      createdById: session.user.id,
    },
  })

  const memberIds = members.map((m) => m.userId)

  // 1. Notifikasi in-app untuk semua anggota
  if (memberIds.length > 0) {
    await db.notification.createMany({
      data: memberIds.map((userId) => ({
        userId,
        type: 'CLASS_ANNOUNCEMENT',
        title: `📢 ${title.trim()} — ${group?.name}`,
        message: message.trim(),
        link: `/kelas/${params.id}?tab=announcements`,
      })),
    })
  }

  // 2. Notifikasi konfirmasi untuk komisaris sendiri
  await db.notification.create({
    data: {
      userId: session.user.id,
      type: 'CLASS_ANNOUNCEMENT',
      title: `✅ Pengumuman terkirim ke ${memberIds.length} anggota — ${group?.name}`,
      message: `"${title.trim()}" berhasil dikirim.`,
      link: `/kelas/${params.id}?tab=announcements`,
    },
  })

  // 3. FCM push notification ke semua anggota
  if (memberIds.length > 0) {
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
      console.error('[FCM] Announce push error:', err)
    }
  }

  return NextResponse.json({ ok: true, sent: memberIds.length, announcement })
}

// DELETE: komisaris hapus pengumuman
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id, role: 'ADMIN' },
  })
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat menghapus pengumuman' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const announcementId = searchParams.get('announcementId')
  if (!announcementId) return NextResponse.json({ error: 'announcementId diperlukan' }, { status: 400 })

  // Pastikan pengumuman milik kelas ini
  const ann = await db.classAnnouncement.findFirst({
    where: { id: announcementId, groupId: params.id },
  })
  if (!ann) return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 })

  await db.classAnnouncement.delete({ where: { id: announcementId } })

  return NextResponse.json({ ok: true })
}
