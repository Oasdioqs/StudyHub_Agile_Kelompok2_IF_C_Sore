import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: ambil semua pengumuman kelas (semua anggota bisa baca)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pastikan user adalah anggota kelas
  const member = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id },
  })
  if (!member) return NextResponse.json({ error: 'Bukan anggota kelas ini' }, { status: 403 })

  const announcements = await db.classAnnouncement.findMany({
    where: { groupId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Ambil info pembuat (nama)
  const userIds = Array.from(new Set(announcements.map((a) => a.createdById)))
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true },
  })
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  return NextResponse.json(
    announcements.map((a) => ({
      ...a,
      createdBy: userMap[a.createdById] ?? { id: a.createdById, name: 'Komisaris', image: null },
    }))
  )

}
