import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: ambil notification settings kelas
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const member = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id },
  })
  if (!member) return NextResponse.json({ error: 'Bukan anggota kelas' }, { status: 403 })

  const setting = await db.classNotificationSetting.findUnique({
    where: { groupId: params.id },
  })

  // Return default jika belum ada setting
  return NextResponse.json(setting ?? {
    taskReminders: [120, 60],
    scheduleReminders: [120, 60],
  })
}

// PATCH: update notification settings kelas (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id, role: 'ADMIN' },
  })
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris' }, { status: 403 })

  const body = await req.json()
  const { taskReminders, scheduleReminders } = body

  const VALID = [1, 5, 10, 30, 60, 120]
  const cleanTask = Array.isArray(taskReminders)
    ? taskReminders.filter((v: number) => VALID.includes(v))
    : [120, 60]
  const cleanSched = Array.isArray(scheduleReminders)
    ? scheduleReminders.filter((v: number) => VALID.includes(v))
    : [120, 60]

  const setting = await db.classNotificationSetting.upsert({
    where: { groupId: params.id },
    create: { groupId: params.id, taskReminders: cleanTask, scheduleReminders: cleanSched },
    update: { taskReminders: cleanTask, scheduleReminders: cleanSched },
  })

  return NextResponse.json(setting)
}
