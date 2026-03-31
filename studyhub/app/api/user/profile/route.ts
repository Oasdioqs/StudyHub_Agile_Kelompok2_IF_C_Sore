import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: profil user lengkap
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, image: true,
      bio: true, institution: true, major: true,
      points: true, streak: true, createdAt: true,
      notificationSetting: { select: { taskReminders: true, scheduleReminders: true } },
      _count: {
        select: { tasks: true, notes: true, flashcardSets: true },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  const doneTasks = await db.task.count({ where: { userId: session.user.id, status: 'DONE' } })
  const kelasCount = await db.groupMember.count({ where: { userId: session.user.id } })

  return NextResponse.json({ ...user, doneTasks, kelasCount })
}

// PATCH: update profil user
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, bio, institution, major } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: name.trim(),
      bio: bio?.trim() || null,
      institution: institution?.trim() || null,
      major: major?.trim() || null,
    },
    select: { id: true, name: true, email: true, bio: true, institution: true, major: true },
  })

  return NextResponse.json(updated)
}
