import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDashboardHistory, saveDashboardDay } from '@/lib/dashboard-days'
import { formatJakartaDate, getJakartaDayRange, getJakartaMondayFirstIndex, getJakartaNowDate } from '@/lib/jakarta-time'
import { findTodayScheduleForDashboard } from '@/lib/weekly-schedule-db'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

function calculateProgress(doneToday: number, totalToday: number, penaltyPercent: number) {
  if (totalToday <= 0) return 0
  const base = Math.round((doneToday / totalToday) * 100)
  return Math.max(0, base - penaltyPercent)
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id

  const { start: todayStart, end: todayEnd, now: jakartaNow } = getJakartaDayRange()
  const todayDow = getJakartaMondayFirstIndex()

  const [
    todayTasks,
    upcomingTasks,
    doneTodayCount,
    overdueTasks,
    upcomingDueTasks,
    completedLateToday,
    recentNotes,
    latestNotifs,
    unreadNotifs,
    history,
    todaySchedule,
  ] = await Promise.all([
    db.task.findMany({
      where: { userId, deadline: { gte: todayStart, lte: todayEnd } },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, description: true, subject: true, deadline: true, priority: true, status: true, createdAt: true },
    }),
    db.task.findMany({
      where: { userId, deadline: { gt: todayEnd } },
      orderBy: { deadline: 'asc' },
      take: 12,
      select: { id: true, title: true, subject: true, deadline: true, priority: true, status: true },
    }),
    db.task.count({
      where: { userId, status: 'DONE', deadline: { gte: todayStart, lte: todayEnd } },
    }),
    db.task.count({
      where: { userId, status: { not: 'DONE' }, deadline: { lt: jakartaNow } },
    }),
    db.task.count({
      where: { userId, status: { not: 'DONE' }, deadline: { gt: todayEnd } },
    }),
    db.task.count({
      where: {
        userId,
        status: 'DONE',
        deadline: { lt: todayStart },
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    db.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, content: true },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
    }),
    db.notification.count({ where: { userId, isRead: false } }),
    getDashboardHistory(userId),
    findTodayScheduleForDashboard(userId, todayDow),
  ])

  const totalToday = todayTasks.length
  const doneToday = doneTodayCount
  const totalTasksOverall = totalToday
  const doneTasksOverall = doneToday
  const totalActiveTasks = Math.max(0, totalToday - doneToday)
  const todayPendingTasks = Math.max(0, totalToday - doneToday)
  const missedDeadlineCount = overdueTasks + completedLateToday
  const progressPenaltyPercent = missedDeadlineCount > 0 ? 10 : 0
  const progress   = calculateProgress(doneToday, totalToday, progressPenaltyPercent)
  await saveDashboardDay(userId, getJakartaNowDate(), {
    totalTasks: totalToday,
    doneTasks: doneToday,
    pendingTasks: todayPendingTasks,
    overdueTasks,
    progress,
  })

  const firstName = session.user.name?.split(' ')[0] ?? 'Kamu'
  const today = formatJakartaDate(new Date(), 'id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const serializedTodayTasks = todayTasks.map((t) => ({ ...t, deadline: t.deadline ? t.deadline.toISOString() : null }))
  const serializedUpcomingTasks = upcomingTasks.map((t) => ({ ...t, deadline: t.deadline ? t.deadline.toISOString() : null }))
  const serializedNotifs = latestNotifs.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))

  return (
    <DashboardClient
      firstName={firstName}
      today={today}
      initial={{
        todayTasks: serializedTodayTasks,
        upcomingTasks: serializedUpcomingTasks,
        doneToday,
        totalToday,
        doneOverall: doneTasksOverall,
        totalOverall: totalTasksOverall,
        totalActive: totalActiveTasks,
        todayPending: todayPendingTasks,
        upcomingDue: upcomingDueTasks,
        missedDeadlineCount,
        progressPenaltyPercent,
        progress,
        overdueCount: overdueTasks,
        recentNotes,
        latestNotifs: serializedNotifs,
        unreadNotifs,
        history,
        todaySchedule,
      }}
    />
  )
}