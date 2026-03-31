import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findAllScheduleSlotsForUser, replaceAllScheduleSlots } from '@/lib/weekly-schedule-db'

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
   * Hitung tanggal aktual hari ini untuk dayOfWeek tertentu (minggu berjalan)
   * dayOfWeek: 0=Minggu, 1=Senin, ..., 6=Sabtu (sama seperti JS getUTCDay)
   */
  function getSlotDate(dayOfWeek: number): Date {
    const today = new Date()
    const todayUTCDay = today.getUTCDay()
    const diffToMonday = todayUTCDay === 0 ? -6 : 1 - todayUTCDay
    const mondayMs = Date.UTC(
      today.getUTCFullYear(), today.getUTCMonth(),
      today.getUTCDate() + diffToMonday
    )
    const offsetFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return new Date(mondayMs + offsetFromMonday * 86400000)
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

  return NextResponse.json(slots)
}
