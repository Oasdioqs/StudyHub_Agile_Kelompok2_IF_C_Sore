import type { TodayScheduleSlot } from '@/lib/weekly-schedule-db'

type TaskLike = {
  id: string
  title: string
  status: string
  deadline: Date | string | null | undefined
}

function parseHHMM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || typeof s !== 'string') return null
  const t = s.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m: min }
}

/** Durasi satu slot dalam menit; butuh start & end. */
export function slotDurationMinutes(startTime: string | null | undefined, endTime: string | null | undefined): number {
  const a = parseHHMM(startTime)
  const b = parseHHMM(endTime)
  if (!a || !b) return 0
  const t0 = a.h * 60 + a.m
  const t1 = b.h * 60 + b.m
  const d = t1 - t0
  return d > 0 ? d : 0
}

export function sumScheduleDurationsMinutes(slots: Pick<TodayScheduleSlot, 'startTime' | 'endTime'>[]): number {
  let total = 0
  for (const s of slots) {
    total += slotDurationMinutes(s.startTime, s.endTime)
  }
  return total
}

export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 m'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} m`
  if (m === 0) return `${h} j`
  return `${h} j ${m} m`
}

export function computeTaskRemainders(tasks: TaskLike[], now: Date) {
  const byId = new Map<string, TaskLike>()
  for (const t of tasks) {
    if (!t.deadline) continue
    if (t.status === 'DONE') continue
    byId.set(t.id, t)
  }
  const taskRemainders: { id: string; title: string; remainingMinutes: number }[] = []
  let taskRemainingMinutesTotal = 0
  for (const t of Array.from(byId.values())) {
    const dl = t.deadline instanceof Date ? t.deadline : new Date(t.deadline as string)
    if (Number.isNaN(dl.getTime())) continue
    const rem = Math.floor((dl.getTime() - now.getTime()) / 60_000)
    if (rem <= 0) continue
    taskRemainingMinutesTotal += rem
    taskRemainders.push({ id: t.id, title: t.title, remainingMinutes: rem })
  }
  taskRemainders.sort((a, b) => a.remainingMinutes - b.remainingMinutes)
  return {
    taskRemainingMinutesTotal,
    pendingTaskCount: taskRemainders.length,
    taskRemainders: taskRemainders.slice(0, 8),
  }
}

export function computeActivityMetrics(
  todaySchedule: Pick<TodayScheduleSlot, 'startTime' | 'endTime'>[],
  todayTasks: TaskLike[],
  upcomingTasks: TaskLike[],
  now: Date,
) {
  const scheduleMinutesTotal = sumScheduleDurationsMinutes(todaySchedule)
  const { taskRemainingMinutesTotal, pendingTaskCount, taskRemainders } = computeTaskRemainders(
    [...todayTasks, ...upcomingTasks],
    now,
  )
  return {
    scheduleMinutesTotal,
    taskRemainingMinutesTotal,
    pendingTaskCount,
    taskRemainders,
  }
}
