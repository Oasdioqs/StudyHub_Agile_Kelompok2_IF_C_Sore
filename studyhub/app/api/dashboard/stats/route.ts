import { loadDashboardStats } from '@/lib/dashboard-load'
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-session'

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  // Tell client when data is partial/stale due to DB issues
  const _fetchError = (stats as any)._dbError ?? false
  return NextResponse.json({ ...stats, _fetchError })
}
