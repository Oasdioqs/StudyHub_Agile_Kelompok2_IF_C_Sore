import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { duration, type, taskId, taskTitle } = await req.json()

  const timerSession = await db.timerSession.create({
    data: {
      duration,
      type: type ?? 'pomodoro',
      taskId: taskId ?? null,
      taskTitle: taskTitle ?? null,
      userId: session.user.id,
    },
  })

  if (type === 'pomodoro') {
    await db.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 15 } },
    })
  }

  return NextResponse.json(timerSession, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '7')

  const since = new Date()
  since.setDate(since.getDate() - days)

  const sessions = await db.timerSession.findMany({
    where: { userId: session.user.id, completedAt: { gte: since } },
    orderBy: { completedAt: 'desc' },
  })

  const totalSeconds = sessions
    .filter(s => s.type === 'pomodoro')
    .reduce((sum, s) => sum + s.duration, 0)

  return NextResponse.json({ sessions, totalSeconds, totalSessions: sessions.filter(s => s.type === 'pomodoro').length })
}
