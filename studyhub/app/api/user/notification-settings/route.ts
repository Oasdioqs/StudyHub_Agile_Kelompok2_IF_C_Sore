import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: ambil notification settings personal user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const setting = await db.userNotificationSetting.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(setting ?? {
    taskReminders: [120, 60],
    scheduleReminders: [120, 60],
  })
}

// PATCH: update notification settings personal
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { taskReminders, scheduleReminders } = body

  const VALID = [1, 5, 10, 30, 60, 120]
  const cleanTask = Array.isArray(taskReminders)
    ? taskReminders.filter((v: number) => VALID.includes(v))
    : [120, 60]
  const cleanSched = Array.isArray(scheduleReminders)
    ? scheduleReminders.filter((v: number) => VALID.includes(v))
    : [120, 60]

  const setting = await db.userNotificationSetting.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, taskReminders: cleanTask, scheduleReminders: cleanSched },
    update: { taskReminders: cleanTask, scheduleReminders: cleanSched },
  })

  return NextResponse.json(setting)
}
