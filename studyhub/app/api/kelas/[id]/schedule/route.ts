import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function getAdminMembership(userId: string, groupId: string) {
  return db.groupMember.findFirst({ where: { userId, groupId, role: 'ADMIN' } })
}
async function getMembership(userId: string, groupId: string) {
  return db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } })
}

// GET: jadwal kelas
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = await getMembership(session.user.id, params.id)
  if (!membership) return NextResponse.json({ error: 'Tidak ada akses' }, { status: 403 })

  const schedule = await db.classScheduleSlot.findMany({
    where: { groupId: params.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  return NextResponse.json(schedule)
}

type SlotInput = {
  dayOfWeek: number
  title: string
  startTime?: string | null
  endTime?: string | null
  place?: string | null
}

// PUT: ganti semua jadwal kelas (admin only) — replace keseluruhan
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengatur jadwal' }, { status: 403 })

  const body = await req.json()
  const raw: SlotInput[] = Array.isArray(body.slots) ? body.slots : []
  const cleaned = raw
    .filter((s) => {
      const dw = Number(s.dayOfWeek)
      return Number.isInteger(dw) && dw >= 0 && dw <= 6 && typeof s.title === 'string' && s.title.trim()
    })
    .map((s) => ({
      groupId: params.id,
      dayOfWeek: Number(s.dayOfWeek),
      title: s.title.trim(),
      startTime: s.startTime?.trim() || null,
      endTime: s.endTime?.trim() || null,
      place: s.place?.trim() || null,
      createdById: session.user.id,
    }))

  // Replace all
  await db.classScheduleSlot.deleteMany({ where: { groupId: params.id } })
  if (cleaned.length > 0) {
    await db.classScheduleSlot.createMany({ data: cleaned })
  }

  // Notifikasi ke semua anggota
  const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
  const members = await db.groupMember.findMany({
    where: { groupId: params.id, NOT: { userId: session.user.id } },
  })
  if (members.length > 0) {
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: 'CLASS_SCHEDULE_UPDATED',
        title: `Jadwal diperbarui: ${group?.name}`,
        message: 'Komisaris telah memperbarui jadwal kuliah mingguan kelas.',
        link: `/kelas/${params.id}`,
      })),
    })
  }

  const schedule = await db.classScheduleSlot.findMany({
    where: { groupId: params.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  return NextResponse.json(schedule)
}
