import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function getMembership(userId: string, groupId: string) {
  return db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } })
}

// GET: detail kelas + tugas + jadwal + anggota
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(session.user.id, params.id)
  if (!membership) return NextResponse.json({ error: 'Tidak ada akses ke kelas ini' }, { status: 403 })

  const [group, tasks, schedule, members] = await Promise.all([
    db.group.findUnique({ where: { id: params.id } }),
    db.classTask.findMany({
      where: { groupId: params.id },
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    }),
    db.classScheduleSlot.findMany({
      where: { groupId: params.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    db.groupMember.findMany({
      where: { groupId: params.id },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
  ])

  if (!group) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 })

  return NextResponse.json({
    ...group,
    myRole: membership.role,
    tasks,
    schedule,
    members: members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
  })
}

// DELETE: keluar atau hapus kelas (admin)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(session.user.id, params.id)
  if (!membership) return NextResponse.json({ error: 'Tidak ada akses' }, { status: 403 })

  if (membership.role === 'ADMIN') {
    // Admin: hapus kelas beserta semua data
    await db.group.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true, action: 'deleted' })
  } else {
    // Member: keluar dari kelas
    await db.groupMember.delete({
      where: { userId_groupId: { userId: session.user.id, groupId: params.id } },
    })
    return NextResponse.json({ ok: true, action: 'left' })
  }
}
