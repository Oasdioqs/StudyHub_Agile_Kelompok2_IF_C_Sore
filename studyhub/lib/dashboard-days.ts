import { db } from '@/lib/db'
import { getJakartaDayRange } from '@/lib/jakarta-time'

export type DashboardDayPayload = {
  totalTasks: number
  doneTasks: number
  pendingTasks: number
  overdueTasks: number
  progress: number
}

function startOfDay(input: Date) {
  return getJakartaDayRange(input).start
}

let hasDashboardDaysTableCache: boolean | null = null

async function hasDashboardDaysTable() {
  if (hasDashboardDaysTableCache !== null) return hasDashboardDaysTableCache
  try {
    const rows = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `select exists (
         select 1
         from information_schema.tables
         where table_schema = 'public' and table_name = 'dashboard_days'
       ) as "exists"`,
    )
    hasDashboardDaysTableCache = Boolean(rows?.[0]?.exists)
    return hasDashboardDaysTableCache
  } catch {
    hasDashboardDaysTableCache = false
    return false
  }
}

export async function saveDashboardDay(userId: string, now: Date, payload: DashboardDayPayload) {
  if (!(await hasDashboardDaysTable())) return
  const dashboardDay = (db as any).dashboardDay
  if (!dashboardDay) return
  const day = startOfDay(now)
  try {
    await dashboardDay.upsert({
      where: { userId_date: { userId, date: day } },
      update: payload,
      create: { userId, date: day, ...payload },
    })

    const cutoff = new Date(day)
    cutoff.setDate(cutoff.getDate() - 6)
    await dashboardDay.deleteMany({
      where: { userId, date: { lt: cutoff } },
    })
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.code === 'P2022') {
      hasDashboardDaysTableCache = false
      return
    }
    throw err
  }
}

export async function getDashboardHistory(userId: string) {
  if (!(await hasDashboardDaysTable())) return []
  const dashboardDay = (db as any).dashboardDay
  if (!dashboardDay) return []
  try {
    const days = await dashboardDay.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 7,
      select: {
        date: true,
        totalTasks: true,
        doneTasks: true,
        pendingTasks: true,
        overdueTasks: true,
        progress: true,
      },
    })
    return days.reverse()
  } catch (err: any) {
    if (err?.code === 'P2021' || err?.code === 'P2022') {
      hasDashboardDaysTableCache = false
      return []
    }
    throw err
  }
}
