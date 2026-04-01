import { db } from '@/lib/db'
import { getDashboardHistory, saveDashboardDay } from '@/lib/dashboard-days'
import { getJakartaDayRange, getJakartaMondayFirstIndex, getJakartaNowDate } from '@/lib/jakarta-time'
import { ensureRemindersForUser } from '@/lib/reminders'
import { findTodayScheduleForDashboard } from '@/lib/weekly-schedule-db'

function calculateProgress(doneToday: number, totalToday: number, penaltyPercent: number) {
  if (totalToday <= 0) return 0
  const base = Math.round((doneToday / totalToday) * 100)
  return Math.max(0, base - penaltyPercent)
}

export async function loadDashboardStats(userId: string, options?: { skipReminders?: boolean }) {
  const { start: todayStart, end: todayEnd, now: jakartaNow } = getJakartaDayRange()
  const todayDow = getJakartaMondayFirstIndex()

  let _dbError = false

  // ── Phase 1: Personal tasks ──
  let todayPersonalTasks: any[] = []
  let upcomingPersonalTasks: any[] = []
  let doneTodayCount = 0
  let overdueTasks = 0
  try {
    ;[todayPersonalTasks, upcomingPersonalTasks, doneTodayCount, overdueTasks] = await Promise.all([
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
      db.task.count({ where: { userId, status: 'DONE', deadline: { gte: todayStart, lte: todayEnd } } }),
      db.task.count({ where: { userId, status: { not: 'DONE' }, deadline: { lt: jakartaNow } } }),
    ])
  } catch { _dbError = true }

  // ── Phase 2: Secondary data ──
  let upcomingDueTasks = 0
  let completedLateToday = 0
  let recentNotes: any[] = []
  let history: any[] = []
  let todaySchedule: any[] = []
  try {
    ;[upcomingDueTasks, completedLateToday, recentNotes, history, todaySchedule] = await Promise.all([
      db.task.count({ where: { userId, status: { not: 'DONE' }, deadline: { gt: todayEnd } } }),
      db.task.count({
        where: { userId, status: 'DONE', deadline: { lt: todayStart }, updatedAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: { id: true, title: true, content: true },
      }),
      getDashboardHistory(userId),
      findTodayScheduleForDashboard(userId, todayDow),
    ])
  } catch { _dbError = true }

  // ── Phase 3: Notifications + class memberships ──
  let latestNotifs: any[] = []
  let unreadNotifs = 0
  let groupMemberships: any[] = []
  try {
    ;[latestNotifs, unreadNotifs, groupMemberships] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
      }),
      db.notification.count({ where: { userId, isRead: false } }),
      db.groupMember.findMany({ where: { userId }, select: { groupId: true } }),
    ])
  } catch { _dbError = true }

  const groupIds = groupMemberships.map((r) => r.groupId)

  // ── Phase 4: Class tasks (hanya jika ada groupIds) — parallel ──
  let todayClassTasks: any[] = []
  let upcomingClassTasks: any[] = []
  if (groupIds.length > 0) {
    try {
      ;[todayClassTasks, upcomingClassTasks] = await Promise.all([
        db.classTask.findMany({
          where: { groupId: { in: groupIds }, deadline: { gte: todayStart, lte: todayEnd } },
          orderBy: { deadline: 'asc' },
          select: { id: true, title: true, description: true, groupId: true, deadline: true, priority: true, createdAt: true,
            group: { select: { name: true } } },
        }),
        db.classTask.findMany({
          where: { groupId: { in: groupIds }, deadline: { gt: todayEnd } },
          orderBy: { deadline: 'asc' },
          take: 8,
          select: { id: true, title: true, groupId: true, deadline: true, priority: true,
            group: { select: { name: true } } },
        }),
      ])
    } catch { _dbError = true }
  }

  // Fire reminders secara non-blocking (tidak menghambat response)
  if (!options?.skipReminders) {
    void ensureRemindersForUser(userId, {
      jakartaNow,
      todayStart,
      todaySchedule,
      groupIds,
    }).catch(() => {})
  }

  // Merge personal + class tasks
  const classTasksToday = todayClassTasks.map((t) => ({
    ...t,
    subject: t.group?.name ?? null,
    status: 'TODO' as const,
    isClassTask: true,
  }))
  const classTasksUpcoming = upcomingClassTasks.map((t) => ({
    ...t,
    subject: t.group?.name ?? null,
    status: 'TODO' as const,
    isClassTask: true,
  }))

  const todayTasks = [...todayPersonalTasks, ...classTasksToday].sort(
    (a, b) => new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime()
  )
  const upcomingTasks = [...upcomingPersonalTasks, ...classTasksUpcoming].sort(
    (a, b) => new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime()
  ).slice(0, 12)

  const totalToday = todayTasks.length
  const doneToday = doneTodayCount
  const totalActiveTasks = Math.max(0, totalToday - doneToday)
  const todayPendingTasks = Math.max(0, totalToday - doneToday)
  const missedDeadlineCount = overdueTasks + completedLateToday
  const progressPenaltyPercent = missedDeadlineCount > 0 ? 10 : 0
  const progress = calculateProgress(doneToday, totalToday, progressPenaltyPercent)

  // Non-blocking save — jangan blokir response
  void saveDashboardDay(userId, getJakartaNowDate(), {
    totalTasks: totalToday,
    doneTasks: doneToday,
    pendingTasks: todayPendingTasks,
    overdueTasks,
    progress,
  }).catch(() => {})

  return {
    todayTasks,
    upcomingTasks,
    doneToday,
    totalToday,
    doneOverall: doneToday,
    totalOverall: totalToday,
    totalActive: totalActiveTasks,
    todayPending: todayPendingTasks,
    upcomingDue: upcomingDueTasks,
    missedDeadlineCount,
    progressPenaltyPercent,
    progress,
    overdueCount: overdueTasks,
    recentNotes,
    latestNotifs,
    unreadNotifs,
    history,
    todaySchedule,
    _dbError,
  }
}
