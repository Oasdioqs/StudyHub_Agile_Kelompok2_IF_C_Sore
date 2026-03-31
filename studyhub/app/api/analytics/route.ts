import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/analytics — aggregated study stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Last 30 days range
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [user, tasks, timerSessions, aiBySessions, threads] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { points: true, streak: true, createdAt: true },
    }),
    db.task.findMany({
      where: { userId },
      select: { status: true, priority: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.timerSession.findMany({
      where: { userId, completedAt: { gte: thirtyDaysAgo } },
      select: { duration: true, completedAt: true, type: true },
      orderBy: { completedAt: 'asc' },
    }),
    db.aISession.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    db.thread.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
  ])

  // Task stats
  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    highPriority: tasks.filter((t) => t.priority === 'HIGH').length,
  }

  // Timer by day (last 7 days)
  const timerByDay = buildDailyMap(
    timerSessions,
    (s) => s.completedAt,
    (s) => Math.round(s.duration / 60), // minutes
    7
  )

  // Timer by day (last 30 days)
  const timerByDay30 = buildDailyMap(
    timerSessions,
    (s) => s.completedAt,
    (s) => Math.round(s.duration / 60),
    30
  )

  // Activity heatmap (last 30 days — count of any activity per day)
  const allActivities = [
    ...timerSessions.map((s) => s.completedAt),
    ...aiBySessions.map((s) => s.createdAt),
    ...threads.map((t) => t.createdAt),
  ]
  const heatmap = buildActivityHeatmap(allActivities, 30)

  // Total focus time
  const totalFocusMinutes = timerSessions.reduce(
    (acc, s) => acc + Math.round(s.duration / 60),
    0
  )

  return NextResponse.json({
    user,
    taskStats,
    timerByDay,       // last 7 days
    timerByDay30,     // last 30 days
    heatmap,
    totalFocusSessions: timerSessions.length,
    totalFocusMinutes,
    totalAISessions: aiBySessions.length,
    totalThreads: threads.length,
  })
}

// Map items to a daily aggregated array for the last N days
function buildDailyMap<T>(
  items: T[],
  getDate: (item: T) => Date,
  getValue: (item: T) => number,
  days: number
): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]

    const dayTotal = items
      .filter((item) => getDate(item).toISOString().split('T')[0] === dateStr)
      .reduce((acc, item) => acc + getValue(item), 0)

    result.push({ date: dateStr, value: dayTotal })
  }
  return result
}

function buildActivityHeatmap(
  dates: Date[],
  days: number
): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = dates.filter(
      (date) => date.toISOString().split('T')[0] === dateStr
    ).length
    result.push({ date: dateStr, count })
  }
  return result
}
