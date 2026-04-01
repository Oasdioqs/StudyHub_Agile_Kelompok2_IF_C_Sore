import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findAllScheduleSlotsForUser, replaceAllScheduleSlots } from '@/lib/weekly-schedule-db'
import { findTodayScheduleForDashboard } from '@/lib/weekly-schedule-db'
import { ensureRemindersForUser } from '@/lib/reminders'
import { getJakartaDayRange, getJakartaMondayFirstIndex } from '@/lib/jakarta-time'

import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const personalSlots = await findAllScheduleSlotsForUser(session.user.id)

  // Ambil jadwal kelas
  const memberships = await db.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true, role: true }
  })
  const adminGroups = new Set(memberships.filter(m => m.role === 'ADMIN').map(m => m.groupId))
  const groupIds = memberships.map(m => m.groupId)

  const classSlotsRaw = await db.classScheduleSlot.findMany({
    where: { groupId: { in: groupIds } },
    include: { group: { select: { name: true } } }
  })

  /**
   * Hitung tanggal lokal minggu ini untuk dayOfWeek tertentu.
   * dayOfWeek mengikuti konvensi Monday-first: 0=Senin, 1=Selasa, ..., 6=Minggu
   */
  function getSlotDate(dayOfWeek: number): Date {
    const today = new Date()
    const todayLocalDay = today.getDay()
    const diffToMonday = todayLocalDay === 0 ? -6 : 1 - todayLocalDay
    const monday = new Date(
      today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday,
      0, 0, 0, 0
    )
    const result = new Date(monday)
    result.setDate(monday.getDate() + dayOfWeek)
    result.setUTCHours(0, 0, 0, 0)
    return result
  }

  // Ambil mode per slot menggunakan tanggal aktual hari masing-masing
  const sessionModeRecords = await Promise.all(
    classSlotsRaw.map((s: any) =>
      db.classSessionMode.findUnique({
        where: {
          slotId_slotType_date: {
            slotId: s.id,
            slotType: 'class',
            date: getSlotDate(s.dayOfWeek),
          },
        },
      })
    )
  )

  const classSlots = classSlotsRaw.map((s: any, i: number) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    title: `${s.title} (${s.group.name})`,
    startTime: s.startTime,
    endTime: s.endTime,
    place: s.place,
    groupId: s.groupId,
    isAdmin: adminGroups.has(s.groupId),
    syncMode: sessionModeRecords[i]?.mode || 'LANGSUNG',
    liveMeetingUrl: sessionModeRecords[i]?.note || null,
  }))

  // Fire reminders non-blocking (agar notifikasi muncul di bel saat user buka kalender)
  const userId = session.user.id
  void (async () => {
    try {
      const { start: todayStart, now: jakartaNow } = getJakartaDayRange()
      const todayDow = getJakartaMondayFirstIndex()
      const todaySchedule = await findTodayScheduleForDashboard(userId, todayDow)
      await ensureRemindersForUser(userId, { jakartaNow, todayStart, todaySchedule, groupIds })
    } catch {}
  })()

  return NextResponse.json([...personalSlots, ...classSlots])
}

type SlotInput = {
  dayOfWeek: number
  title: string
  startTime?: string | null
  endTime?: string | null
  place?: string | null
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { slots?: SlotInput[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const raw = Array.isArray(body.slots) ? body.slots : []
  const cleaned: {
    dayOfWeek: number
    title: string
    startTime: string | null
    endTime: string | null
    place: string | null
  }[] = []
  for (const s of raw) {
    const dw = Number(s.dayOfWeek)
    if (!Number.isInteger(dw) || dw < 0 || dw > 6) continue
    const title = typeof s.title === 'string' ? s.title.trim() : ''
    if (!title) continue
    cleaned.push({
      dayOfWeek: dw,
      title,
      startTime: typeof s.startTime === 'string' && s.startTime.trim() ? s.startTime.trim() : null,
      endTime: typeof s.endTime === 'string' && s.endTime.trim() ? s.endTime.trim() : null,
      place: typeof s.place === 'string' && s.place.trim() ? s.place.trim() : null,
    })
  }

  const userId = session.user.id
  const slots = await replaceAllScheduleSlots(userId, cleaned)
  if (slots === null) {
    return NextResponse.json(
      {
        error:
          'Tabel jadwal belum tersedia. Hentikan npm run dev, lalu jalankan: npx prisma db push && npx prisma generate',
      },
      { status: 503 },
    )
  }

  // ── Gabungkan dengan jadwal kelas (sama seperti GET) agar frontend tidak kehilangan data ──
  const memberships = await db.groupMember.findMany({
    where: { userId },
    select: { groupId: true, role: true }
  })
  const adminGroups = new Set(memberships.filter(m => m.role === 'ADMIN').map(m => m.groupId))
  const groupIds = memberships.map(m => m.groupId)

  const classSlotsRaw = groupIds.length > 0
    ? await db.classScheduleSlot.findMany({
        where: { groupId: { in: groupIds } },
        include: { group: { select: { name: true } } }
      })
    : []

  function getSlotDatePut(dayOfWeek: number): Date {
    const today = new Date()
    const todayLocalDay = today.getDay()
    const diffToMonday = todayLocalDay === 0 ? -6 : 1 - todayLocalDay
    const monday = new Date(
      today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday,
      0, 0, 0, 0
    )
    const result = new Date(monday)
    result.setDate(monday.getDate() + dayOfWeek)
    result.setUTCHours(0, 0, 0, 0)
    return result
  }

  const sessionModeRecords = await Promise.all(
    classSlotsRaw.map((s: any) =>
      db.classSessionMode.findUnique({
        where: {
          slotId_slotType_date: {
            slotId: s.id,
            slotType: 'class',
            date: getSlotDatePut(s.dayOfWeek),
          },
        },
      })
    )
  )

  const classSlots = classSlotsRaw.map((s: any, i: number) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    title: `${s.title} (${s.group.name})`,
    startTime: s.startTime,
    endTime: s.endTime,
    place: s.place,
    groupId: s.groupId,
    isAdmin: adminGroups.has(s.groupId),
    syncMode: sessionModeRecords[i]?.mode || 'LANGSUNG',
    liveMeetingUrl: sessionModeRecords[i]?.note || null,
  }))

  return NextResponse.json([...slots, ...classSlots])
}
