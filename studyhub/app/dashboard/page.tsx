import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadDashboardStats } from '@/lib/dashboard-load'
import { formatJakartaDate } from '@/lib/jakarta-time'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id

  const stats = await loadDashboardStats(userId, { skipReminders: true }).catch(() => ({
    todayTasks: [],
    upcomingTasks: [],
    doneToday: 0,
    totalToday: 0,
    doneOverall: 0,
    totalOverall: 0,
    totalActive: 0,
    todayPending: 0,
    upcomingDue: 0,
    missedDeadlineCount: 0,
    progressPenaltyPercent: 0,
    progress: 0,
    overdueCount: 0,
    recentNotes: [],
    latestNotifs: [],
    unreadNotifs: 0,
    history: [],
    todaySchedule: [],
    _dbError: true,
  }))

  const {
    todayTasks,
    upcomingTasks,
    latestNotifs,
    ...rest
  } = stats

  const firstName = session.user.name?.split(' ')[0] ?? 'Kamu'
  const today = formatJakartaDate(new Date(), 'id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
        latestNotifs: serializedNotifs,
        ...rest,
      }}
    />
  )
}
