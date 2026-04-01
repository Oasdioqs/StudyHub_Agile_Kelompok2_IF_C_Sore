import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotificationsWithPush } from '@/lib/notification-push'

// POST: gabung kelas via kode undangan
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // params.id bisa berupa groupId atau inviteCode
  const body = await req.json().catch(() => ({}))
  const inviteCode = String(body.inviteCode || '').trim()

  // Cari grup via inviteCode
  const group = await db.group.findUnique({
    where: { inviteCode },
    include: { _count: { select: { members: true } } },
  })

  if (!group) return NextResponse.json({ error: 'Kode undangan tidak valid' }, { status: 404 })

  // Cek sudah member
  const existing = await db.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
  })
  if (existing) return NextResponse.json({ error: 'Kamu sudah bergabung di kelas ini' }, { status: 400 })

  // Cek kapasitas
  if (group._count.members >= group.maxMembers) {
    return NextResponse.json({ error: 'Kelas sudah penuh' }, { status: 400 })
  }

  await db.groupMember.create({
    data: { userId: session.user.id, groupId: group.id, role: 'MEMBER' },
  })

  // Notifikasi untuk admin kelas
  const admins = await db.groupMember.findMany({
    where: { groupId: group.id, role: 'ADMIN' },
  })
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } })

  await createNotificationsWithPush(
    admins.map((admin) => admin.userId),
    {
      type: 'CLASS_JOIN',
      title: 'Anggota baru bergabung',
      message: `${user?.name} bergabung ke kelas "${group.name}".`,
      link: `/kelas/${group.id}`,
    },
    { pushUrl: `/kelas/${group.id}` },
  )

  return NextResponse.json({ ok: true, groupId: group.id, groupName: group.name })
}
