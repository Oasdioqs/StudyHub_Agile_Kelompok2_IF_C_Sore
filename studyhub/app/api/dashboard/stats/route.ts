// app/api/dashboard/stats/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
  const todayEnd   = new Date(new Date().setHours(23, 59, 59, 999))

  const [
    todayTasks,
    completedTodayTasks,
    upcomingTasks,
    recentNotes,
    unreadNotifs,
  ] = await Promise.all([
    db.task.findMany({
      where: { userId, deadline: { gte: todayStart, lte: todayEnd } },
      select: { id: true, title: true, subject: true, priority: true, status: true },
    }),
    db.task.findMany({
      where: { userId, status: 'DONE', deadline: { gte: todayStart, lte: todayEnd } },
      select: { id: true },
    }),
    db.task.findMany({
      where: { userId, status: { not: 'DONE' }, deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' },
      take: 5,
      select: { id: true },
    }),
    db.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, content: true },
    }),
    db.notification.count({ where: { userId, isRead: false } }),
  ])

  const totalToday = todayTasks.length
  const doneToday  = completedTodayTasks.length
  const progress   = totalToday === 0 ? 100 : Math.round((doneToday / totalToday) * 100)

  return NextResponse.json({
    todayTasks,
    doneToday,
    totalToday,
    progress,
    upcomingCount:  upcomingTasks.length,
    recentNotes,
    unreadNotifs,
  })
}