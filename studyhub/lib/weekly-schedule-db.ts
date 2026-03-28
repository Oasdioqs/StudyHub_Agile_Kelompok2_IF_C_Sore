import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type TodayScheduleSlot = {
  id: string
  dayOfWeek: number
  title: string
  startTime: string | null
  endTime: string | null
  place: string | null
}

const SELECT = {
  id: true,
  dayOfWeek: true,
  title: true,
  startTime: true,
  endTime: true,
  place: true,
} as const

export function isScheduleDbUnavailable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('weekly_schedule') && (msg.includes('does not exist') || msg.includes('Unknown table'))) return true
  if (e instanceof TypeError) {
    const m = String(e.message ?? '')
    return m.includes('findMany') || m.includes('deleteMany') || m.includes('createMany') || m.includes('undefined')
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2021' || e.code === 'P2010') return true
  }
  return false
}

/** Jadwal hari ini untuk dashboard; [] jika tabel belum dimigrasi atau client Prisma belum di-generate ulang. */
export async function findTodayScheduleForDashboard(userId: string, dayOfWeek: number): Promise<TodayScheduleSlot[]> {
  try {
    return await db.weeklyScheduleSlot.findMany({
      where: { userId, dayOfWeek },
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
      select: SELECT,
    })
  } catch (e) {
    if (isScheduleDbUnavailable(e)) return []
    throw e
  }
}

export async function findAllScheduleSlotsForUser(userId: string) {
  try {
    return await db.weeklyScheduleSlot.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  } catch (e) {
    if (isScheduleDbUnavailable(e)) return []
    throw e
  }
}

type CleanedSlot = {
  dayOfWeek: number
  title: string
  startTime: string | null
  endTime: string | null
  place: string | null
}

export async function replaceAllScheduleSlots(userId: string, cleaned: CleanedSlot[]) {
  try {
    await db.$transaction(async (tx) => {
      await tx.weeklyScheduleSlot.deleteMany({ where: { userId } })
      if (cleaned.length) {
        await tx.weeklyScheduleSlot.createMany({
          data: cleaned.map((s, i) => ({
            userId,
            dayOfWeek: s.dayOfWeek,
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime,
            place: s.place,
            sortOrder: i,
          })),
        })
      }
    })
    return await db.weeklyScheduleSlot.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  } catch (e) {
    if (isScheduleDbUnavailable(e)) return null
    throw e
  }
}
