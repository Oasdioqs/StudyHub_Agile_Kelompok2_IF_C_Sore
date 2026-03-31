import { db } from '@/lib/db'
import { formatJakartaYmd, getJakartaDayRange, getJakartaMondayFirstIndex } from '@/lib/jakarta-time'
import { findTodayScheduleForDashboard, type TodayScheduleSlot } from '@/lib/weekly-schedule-db'
import { sendPushToToken, sendPushToTokens } from '@/lib/firebase-admin'

// Helper: ambil FCM tokens untuk satu user
async function getUserTokens(userId: string): Promise<string[]> {
  const rows = await db.fcmToken.findMany({ where: { userId }, select: { token: true } })
  return rows.map((r) => r.token)
}

// Helper: ambil FCM tokens untuk semua anggota kelas
async function getGroupTokens(memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return []
  const rows = await db.fcmToken.findMany({
    where: { userId: { in: memberIds } },
    select: { token: true },
  })
  return rows.map((r) => r.token)
}

const ALL_INTERVALS = [1, 5, 10, 30, 60, 120] as const
type Interval = typeof ALL_INTERVALS[number]

// Window yang disesuaikan per interval agar tidak overlap
const WINDOW_MS: Record<Interval, number> = {
  1: 3 * 60 * 1000,       // ±3 menit untuk 1 menit
  5: 5 * 60 * 1000,       // ±5 menit untuk 5 menit
  10: 8 * 60 * 1000,      // ±8 menit untuk 10 menit
  30: 12 * 60 * 1000,     // ±12 menit untuk 30 menit
  60: 15 * 60 * 1000,     // ±15 menit untuk 1 jam
  120: 22 * 60 * 1000,    // ±22 menit untuk 2 jam
}

function labelForInterval(minutesBefore: number): string {
  if (minutesBefore === 120) return '2 jam lagi'
  if (minutesBefore === 60) return '1 jam lagi'
  if (minutesBefore === 30) return '30 menit lagi'
  if (minutesBefore === 10) return '10 menit lagi'
  if (minutesBefore === 5) return '5 menit lagi'
  return '1 menit lagi'
}

function parseHHMM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || typeof s !== 'string') return null
  const t = s.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!match) return null
  const h = Number(match[1])
  const min = Number(match[2])
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

function inReminderWindow(now: Date, eventAt: Date, minutesBefore: number): boolean {
  const fireAt = new Date(eventAt.getTime() - minutesBefore * 60 * 1000)
  const window = WINDOW_MS[minutesBefore as Interval] ?? WINDOW_MS[60]
  return now.getTime() >= fireAt.getTime() && now.getTime() < fireAt.getTime() + window
}

async function notificationExists(userId: string, link: string) {
  const n = await db.notification.findFirst({ where: { userId, link } })
  return Boolean(n)
}

async function classReminderAnnouncementExists(groupId: string, link: string) {
  const n = await db.classAnnouncement.findFirst({ where: { groupId, title: link } })
  return Boolean(n)
}

// ──────────────────────────────────────────────
// PERSONAL REMINDERS (tugas & jadwal pribadi)
// ──────────────────────────────────────────────
export async function ensureRemindersForUser(
  userId: string,
  opts: {
    jakartaNow: Date
    todayStart: Date
    todaySchedule: TodayScheduleSlot[]
    groupIds?: string[]
  },
) {
  const { jakartaNow: now, todayStart, todaySchedule, groupIds } = opts
  const ymdSchedule = formatJakartaYmd(now)

  // Ambil preferensi interval user (personal)
  const userSetting = await db.userNotificationSetting.findUnique({
    where: { userId },
    select: { taskReminders: true, scheduleReminders: true },
  })
  const personalScheduleIntervals: number[] = userSetting?.scheduleReminders ?? [120, 60]
  const personalTaskIntervals: number[] = userSetting?.taskReminders ?? [120, 60]

  // ── Jadwal Pribadi ──
  for (const slot of todaySchedule) {
    const startAt = slotStartOnDay(todayStart.getTime(), slot.startTime)
    if (!startAt || startAt.getTime() <= now.getTime()) continue

    for (const minutesBefore of personalScheduleIntervals) {
      if (!inReminderWindow(now, startAt, minutesBefore)) continue
      const link = `reminder:schedule:${slot.id}:${ymdSchedule}:${minutesBefore}m`
      if (await notificationExists(userId, link)) continue
      const notifMsg = `${slot.title} mulai pukul ${formatTimeLabel(slot.startTime)} WIB${slot.place ? ` · ${slot.place}` : ''}`
      await db.notification.create({
        data: {
          userId,
          type: 'schedule_reminder',
          title: `Jadwal · ${labelForInterval(minutesBefore)}`,
          message: notifMsg,
          link,
        },
      })
      // FCM push (fire-and-forget)
      void getUserTokens(userId).then((tokens) =>
        tokens.forEach((t) => sendPushToToken(t, {
          title: `📅 Jadwal · ${labelForInterval(minutesBefore)}`,
          body: notifMsg,
          url: '/calendar',
        }))
      ).catch(() => {})
    }
  }

  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // ── Tugas Pribadi ──
  const tasks = await db.task.findMany({
    where: { userId, status: { not: 'DONE' }, deadline: { gt: now, lte: horizon } },
    select: { id: true, title: true, deadline: true },
  })

  for (const task of tasks) {
    if (!task.deadline) continue
    const deadline = task.deadline
    for (const minutesBefore of personalTaskIntervals) {
      if (!inReminderWindow(now, deadline, minutesBefore)) continue
      const ymd = formatJakartaYmd(deadline)
      const link = `reminder:task:${task.id}:${ymd}:${minutesBefore}m`
      if (await notificationExists(userId, link)) continue
      const deadlineStr = deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })
      const notifMsg = `${task.title} — selesaikan sebelum ${deadlineStr} WIB`
      await db.notification.create({
        data: {
          userId,
          type: 'task_deadline_reminder',
          title: `Deadline · ${labelForInterval(minutesBefore)}`,
          message: notifMsg,
          link,
        },
      })
      // FCM push (fire-and-forget)
      void getUserTokens(userId).then((tokens) =>
        tokens.forEach((t) => sendPushToToken(t, {
          title: `⏰ Deadline · ${labelForInterval(minutesBefore)}`,
          body: notifMsg,
          url: '/tasks',
        }))
      ).catch(() => {})
    }
  }

  // ── Class Reminders (dikirim ke semua anggota + Pengumuman) ──
  if (groupIds && groupIds.length > 0) {
    void ensureClassReminders(now, groupIds).catch(() => {})
  }
}

// ──────────────────────────────────────────────
// CLASS REMINDERS (tugas & jadwal kelas)
// → ClassAnnouncement + semua anggota
// ──────────────────────────────────────────────
async function ensureClassReminders(now: Date, groupIds: string[]) {
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  for (const groupId of groupIds) {
    // Ambil setting interval kelas
    const setting = await db.classNotificationSetting.findUnique({
      where: { groupId },
      select: { taskReminders: true, scheduleReminders: true },
    })
    const taskIntervals: number[] = setting?.taskReminders ?? [120, 60]

    // Ambil semua anggota kelas
    const members = await db.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    })
    const memberIds = members.map((m) => m.userId)
    if (memberIds.length === 0) continue

    // Nama kelas untuk pesan
    const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } })
    const groupName = group?.name ?? 'Kelas'

    // ── Tugas Kelas ──
    const classTasks = await db.classTask.findMany({
      where: { groupId, deadline: { gt: now, lte: horizon } },
      select: { id: true, title: true, deadline: true },
    })

    for (const task of classTasks) {
      if (!task.deadline) continue
      const deadline = task.deadline
      for (const minutesBefore of taskIntervals) {
        if (!inReminderWindow(now, deadline, minutesBefore)) continue
        const ymd = formatJakartaYmd(deadline)
        const dedupKey = `class-task-reminder:${task.id}:${ymd}:${minutesBefore}m`

        // Cegah double send via ClassAnnouncement title sebagai dedup key
        if (await classReminderAnnouncementExists(groupId, dedupKey)) continue

        // Simpan ke Pengumuman kelas
        await db.classAnnouncement.create({
          data: {
            groupId,
            title: dedupKey, // digunakan sebagai dedup key
            message: `📚 Reminder Tugas · ${labelForInterval(minutesBefore)}\n\n**${task.title}** — deadline ${deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })} WIB`,
            createdById: 'system',
          },
        })

        // Kirim notif ke semua anggota
        if (memberIds.length > 0) {
          await db.notification.createMany({
            data: memberIds.map((uid) => ({
              userId: uid,
              type: 'class_task_reminder',
              title: `📚 [​${groupName}] Tugas · ${labelForInterval(minutesBefore)}`,
              message: `${task.title} — deadline ${deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })} WIB`,
              link: `/kelas/${groupId}?tab=announcements`,
            })),
            skipDuplicates: true,
          })
          // FCM push ke semua device anggota
          void getGroupTokens(memberIds).then((tokens) =>
            sendPushToTokens(tokens, {
              title: `📚 [​${groupName}] Tugas · ${labelForInterval(minutesBefore)}`,
              body: `${task.title} — deadline ${deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })} WIB`,
              url: `/kelas/${groupId}?tab=announcements`,
            })
          ).catch(() => {})
        }
      }
    }

    // ── Jadwal Kelas (semua slot hari ini) ──
    const scheduleIntervals: number[] = setting?.scheduleReminders ?? [120, 60]
    const todayDow = new Date(now).getDay() // 0=Sun
    // Convert to Monday-first (0=Mon)
    const mondayFirst = todayDow === 0 ? 6 : todayDow - 1
    const { start: todayStart } = require('@/lib/jakarta-time').getJakartaDayRange()

    const classSlots = await db.classScheduleSlot.findMany({
      where: { groupId, dayOfWeek: mondayFirst },
      select: { id: true, title: true, startTime: true, place: true },
    })

    for (const slot of classSlots) {
      const startAt = slotStartOnDay(todayStart.getTime(), slot.startTime)
      if (!startAt || startAt.getTime() <= now.getTime()) continue

      const ymd = formatJakartaYmd(now)
      for (const minutesBefore of scheduleIntervals) {
        if (!inReminderWindow(now, startAt, minutesBefore)) continue
        const dedupKey = `class-schedule-reminder:${slot.id}:${ymd}:${minutesBefore}m`

        if (await classReminderAnnouncementExists(groupId, dedupKey)) continue

        await db.classAnnouncement.create({
          data: {
            groupId,
            title: dedupKey,
            message: `🏫 Reminder Jadwal · ${labelForInterval(minutesBefore)}\n\n**${slot.title}** mulai pukul ${formatTimeLabel(slot.startTime)} WIB${slot.place ? ` · ${slot.place}` : ''}`,
            createdById: 'system',
          },
        })

        if (memberIds.length > 0) {
          await db.notification.createMany({
            data: memberIds.map((uid) => ({
              userId: uid,
              type: 'class_schedule_reminder',
              title: `🏫 [​${groupName}] Jadwal · ${labelForInterval(minutesBefore)}`,
              message: `${slot.title} mulai pukul ${formatTimeLabel(slot.startTime)} WIB${slot.place ? ` · ${slot.place}` : ''}`,
              link: `/kelas/${groupId}?tab=announcements`,
            })),
            skipDuplicates: true,
          })
          // FCM push ke semua device anggota
          void getGroupTokens(memberIds).then((tokens) =>
            sendPushToTokens(tokens, {
              title: `🏫 [​${groupName}] Jadwal · ${labelForInterval(minutesBefore)}`,
              body: `${slot.title} mulai pukul ${formatTimeLabel(slot.startTime)} WIB${slot.place ? ` · ${slot.place}` : ''}`,
              url: `/kelas/${groupId}?tab=announcements`,
            })
          ).catch(() => {})
        }
      }
    }
  }
}

// ──────────────────────────────────────────────
// BULK: untuk semua user (cron / admin trigger)
// ──────────────────────────────────────────────
export async function ensureRemindersForAllUsers() {
  const [slotGroups, taskGroups] = await Promise.all([
    db.weeklyScheduleSlot.groupBy({ by: ['userId'], _count: { _all: true } }),
    db.task.groupBy({
      by: ['userId'],
      where: { status: { not: 'DONE' }, deadline: { gt: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) } },
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
      const groupIds = await db.groupMember
        .findMany({ where: { userId }, select: { groupId: true } })
        .then((rows) => rows.map((r) => r.groupId))
      await ensureRemindersForUser(userId, { jakartaNow, todayStart, todaySchedule, groupIds })
    } catch { /* ignore per-user errors */ }
  }
}
