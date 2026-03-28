import { db } from '@/lib/db'
import { formatJakartaYmd, getJakartaDayRange, getJakartaMondayFirstIndex } from '@/lib/jakarta-time'
import { findTodayScheduleForDashboard, type TodayScheduleSlot } from '@/lib/weekly-schedule-db'

const REMINDER_WINDOW_MS = 22 * 60 * 1000

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

function slotStartOnDay(dayStartMs: number, timeStr: string | null | undefined): Date | null {
  const t = parseHHMM(timeStr)
  if (!t) return null
  return new Date(dayStartMs + (t.h * 60 + t.m) * 60 * 1000)
}

function formatTimeLabel(timeStr: string | null | undefined): string {
  const t = parseHHMM(timeStr)
  if (!t) return '—'
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`
}

function inReminderWindow(now: Date, eventAt: Date, hoursBefore: number): boolean {
  const fireAt = new Date(eventAt.getTime() - hoursBefore * 60 * 60 * 1000)
  return now.getTime() >= fireAt.getTime() && now.getTime() < fireAt.getTime() + REMINDER_WINDOW_MS
}

async function notificationExists(userId: string, link: string) {
  const n = await db.notification.findFirst({ where: { userId, link } })
  return Boolean(n)
}

/** Pengingat jadwal (2h & 1h sebelum mulai) dan tugas (2h & 1h sebelum deadline). WIB. */
export async function ensureRemindersForUser(
  userId: string,
  opts: {
    jakartaNow: Date
    todayStart: Date
    todaySchedule: TodayScheduleSlot[]
  },
) {
  const { jakartaNow: now, todayStart, todaySchedule } = opts
  const ymdSchedule = formatJakartaYmd(now)

  for (const slot of todaySchedule) {
    const startAt = slotStartOnDay(todayStart.getTime(), slot.startTime)
    if (!startAt || startAt.getTime() <= now.getTime()) continue

    for (const hoursBefore of [2, 1] as const) {
      if (!inReminderWindow(now, startAt, hoursBefore)) continue
      const link = `reminder:schedule:${slot.id}:${ymdSchedule}:${hoursBefore}h`
      if (await notificationExists(userId, link)) continue
      await db.notification.create({
        data: {
          userId,
          type: 'schedule_reminder',
          title: hoursBefore === 2 ? 'Jadwal · 2 jam lagi' : 'Jadwal · 1 jam lagi',
          message: `${slot.title} mulai pukul ${formatTimeLabel(slot.startTime)} WIB${slot.place ? ` · ${slot.place}` : ''}`,
          link,
        },
      })
    }
  }

  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const tasks = await db.task.findMany({
    where: {
      userId,
      status: { not: 'DONE' },
      deadline: { gt: now, lte: horizon },
    },
    select: { id: true, title: true, deadline: true },
  })

  for (const task of tasks) {
    if (!task.deadline) continue
    const deadline = task.deadline
    for (const hoursBefore of [2, 1] as const) {
      if (!inReminderWindow(now, deadline, hoursBefore)) continue
      const ymd = formatJakartaYmd(deadline)
      const link = `reminder:task:${task.id}:${ymd}:${hoursBefore}h`
      if (await notificationExists(userId, link)) continue
      await db.notification.create({
        data: {
          userId,
          type: 'task_deadline_reminder',
          title: hoursBefore === 2 ? 'Deadline · 2 jam lagi' : 'Deadline · 1 jam lagi',
          message: `${task.title} — selesaikan sebelum ${deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })} WIB`,
          link,
        },
      })
    }
  }
}

/** Untuk cron: semua user yang punya jadwal mingguan atau tugas mendatang. */
export async function ensureRemindersForAllUsers() {
  const [slotGroups, taskGroups] = await Promise.all([
    db.weeklyScheduleSlot.groupBy({ by: ['userId'], _count: { _all: true } }),
    db.task.groupBy({
      by: ['userId'],
      where: {
        status: { not: 'DONE' },
        deadline: { gt: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      },
      _count: { _all: true },
    }),
  ])
  const ids = new Set<string>()
  for (const r of slotGroups) ids.add(r.userId)
  for (const r of taskGroups) ids.add(r.userId)

  const { start: todayStart, now: jakartaNow } = getJakartaDayRange()
  const todayDow = getJakartaMondayFirstIndex()

  for (const userId of Array.from(ids)) {
    try {
      const todaySchedule = await findTodayScheduleForDashboard(userId, todayDow)
      await ensureRemindersForUser(userId, { jakartaNow, todayStart, todaySchedule })
    } catch {
      /* skip user on error */
    }
  }
}
