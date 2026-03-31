import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function getAdminMembership(userId: string, groupId: string) {
  return db.groupMember.findFirst({ where: { userId, groupId, role: 'ADMIN' } })
}
async function getMembership(userId: string, groupId: string) {
  return db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } })
}

// GET: jadwal kelas
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = await getMembership(session.user.id, params.id)
  if (!membership) return NextResponse.json({ error: 'Tidak ada akses' }, { status: 403 })

  const schedule = await db.classScheduleSlot.findMany({
    where: { groupId: params.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  // Ambil mode sinkronisasi aktif minggu ini per slot
  const today = new Date()
  // Normalize to UTC midnight of current Sunday for consistent key across timezones
  const dayOfWeekUTC = today.getUTCDay()
  const weekStartMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeekUTC)
  const weekStart = new Date(weekStartMs)

  const sessionModes = await db.classSessionMode.findMany({
    where: {
      slotId: { in: schedule.map((s) => s.id) },
      slotType: 'class',
      date: weekStart,
    },
  })

  const modeMap: Record<string, string> = {}
  for (const sm of sessionModes) {
    modeMap[sm.slotId] = sm.mode
  }

  const result = schedule.map((s) => ({
    ...s,
    syncMode: modeMap[s.id] || 'LANGSUNG',
    liveMeetingUrl: sessionModes.find((sm) => sm.slotId === s.id)?.note || null,
  }))

  return NextResponse.json(result)
}

type SlotInput = {
  dayOfWeek: number
  title: string
  startTime?: string | null
  endTime?: string | null
  place?: string | null
}

// PUT: atur jadwal kelas (admin only)
// Logika:
// - Jika belum ada jadwal → simpan sebagai default permanen
// - Jika sudah ada jadwal + body hanya berisi syncMode → update mode minggu ini saja (tidak hapus jadwal)
// - Jika sudah ada jadwal + body berisi slots → replace jadwal (komisaris mengubah jadwal tetap)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengatur jadwal' }, { status: 403 })

  const body = await req.json()

  // ─── Mode-only update (toggle sync mode mingguan) ────────────────────────────
  if (body.syncMode && !body.slots) {
    const modeValue = body.syncMode === 'MAYA' ? 'MAYA' : 'LANGSUNG'
    const slotId = body.slotId // optional: update specific slot

    // Tentukan tanggal untuk minggu ini — UTC midnight of current Sunday
    const today = new Date()
    const dayOfWeekUTC = today.getUTCDay()
    const weekStartMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeekUTC)
    const weekStart = new Date(weekStartMs)


    // Ambil semua slot kelas ini (atau slot tertentu)
    const targetSlots = await db.classScheduleSlot.findMany({
      where: slotId
        ? { id: slotId, groupId: params.id }
        : { groupId: params.id },
    })

    // Upsert mode untuk setiap slot pada minggu ini
    for (const slot of targetSlots) {
      await db.classSessionMode.upsert({
        where: {
          slotId_slotType_date: {
            slotId: slot.id,
            slotType: 'class',
            date: weekStart,
          },
        },
        update: { mode: modeValue as 'MAYA' | 'LANGSUNG', setById: session.user.id },
        create: {
          slotId: slot.id,
          slotType: 'class',
          date: weekStart,
          mode: modeValue as 'MAYA' | 'LANGSUNG',
          setById: session.user.id,
          groupId: params.id,
        },
      })
    }

    // Notifikasi ke semua anggota
    const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
    const members = await db.groupMember.findMany({
      where: { groupId: params.id, NOT: { userId: session.user.id } },
    })
    if (members.length > 0) {
      await db.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          type: 'CLASS_SCHEDULE_UPDATED',
          title: `Mode kelas diperbarui: ${group?.name}`,
          message: `Komisaris mengubah mode kuliah minggu ini menjadi ${modeValue === 'MAYA' ? 'Sinkron Maya (Online)' : 'Langsung (Tatap Muka)'}.`,
          link: `/kelas/${params.id}`,
        })),
      })
    }

    const updatedSchedule = await db.classScheduleSlot.findMany({
      where: { groupId: params.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    const modeMap: Record<string, string> = {}
    for (const slot of targetSlots) {
      modeMap[slot.id] = modeValue
    }

    // Get live meeting URLs from note field
    const weekStart2 = new Date(weekStartMs)
    const sessionModes = await db.classSessionMode.findMany({
      where: { slotId: { in: updatedSchedule.map((s) => s.id) }, slotType: 'class', date: weekStart2 },
    })
    const noteMap: Record<string, string | null> = {}
    for (const sm of sessionModes) {
      noteMap[sm.slotId] = sm.note
    }

    return NextResponse.json(
      updatedSchedule.map((s) => ({
        ...s,
        syncMode: modeMap[s.id] || 'LANGSUNG',
        liveMeetingUrl: noteMap[s.id] || null,
      }))
    )
  }

  // ─── Live meeting URL only update (no syncMode, no slots) ───────────────────────────
  if ('liveMeetingUrl' in body && body.slotId && !body.syncMode && !body.slots) {
    const slotId = body.slotId as string
    const liveMeetingUrl = typeof body.liveMeetingUrl === 'string' ? body.liveMeetingUrl.trim() : ''

    // Ensure slot belongs to this group
    const slot = await db.classScheduleSlot.findFirst({ where: { id: slotId, groupId: params.id } })
    if (!slot) return NextResponse.json({ error: 'Slot tidak ditemukan' }, { status: 404 })

    const today = new Date()
    const dayOfWeekUTC = today.getUTCDay()
    const weekStartMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOfWeekUTC)
    const weekStart = new Date(weekStartMs)

    // Upsert — simpan URL ke note field, mode tetap seperti semula
    const existing = await db.classSessionMode.findUnique({
      where: { slotId_slotType_date: { slotId: slot.id, slotType: 'class', date: weekStart } },
    })
    if (existing) {
      await db.classSessionMode.update({
        where: { slotId_slotType_date: { slotId: slot.id, slotType: 'class', date: weekStart } },
        data: { note: liveMeetingUrl || null },
      })
    } else {
      await db.classSessionMode.create({
        data: {
          slotId: slot.id,
          slotType: 'class',
          date: weekStart,
          mode: 'LANGSUNG',
          note: liveMeetingUrl || null,
          setById: session.user.id,
          groupId: params.id,
        },
      })
    }

    const schedule = await db.classScheduleSlot.findMany({
      where: { groupId: params.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    const sessionModes = await db.classSessionMode.findMany({
      where: { slotId: { in: schedule.map((s) => s.id) }, slotType: 'class', date: weekStart },
    })
    const modeMap2: Record<string, string> = {}
    const noteMap2: Record<string, string | null> = {}
    for (const sm of sessionModes) {
      modeMap2[sm.slotId] = sm.mode
      noteMap2[sm.slotId] = sm.note
    }
    return NextResponse.json(schedule.map((s) => ({
      ...s,
      syncMode: modeMap2[s.id] || 'LANGSUNG',
      liveMeetingUrl: noteMap2[s.id] || null,
    })))
  }

  // ─── Full slot update ─────────────────────────────────────────────────────────
  const raw: SlotInput[] = Array.isArray(body.slots) ? body.slots : []
  const cleaned = raw
    .filter((s) => {
      const dw = Number(s.dayOfWeek)
      return Number.isInteger(dw) && dw >= 0 && dw <= 6 && typeof s.title === 'string' && s.title.trim()
    })
    .map((s) => ({
      groupId: params.id,
      dayOfWeek: Number(s.dayOfWeek),
      title: s.title.trim(),
      startTime: s.startTime?.trim() || null,
      endTime: s.endTime?.trim() || null,
      place: s.place?.trim() || null,
      createdById: session.user.id,
    }))

  const existingCount = await db.classScheduleSlot.count({ where: { groupId: params.id } })
  const isFirstTime = existingCount === 0

  // Replace all slots
  await db.classScheduleSlot.deleteMany({ where: { groupId: params.id } })
  if (cleaned.length > 0) {
    await db.classScheduleSlot.createMany({ data: cleaned })
  }

  // Notifikasi ke semua anggota
  const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
  const members = await db.groupMember.findMany({
    where: { groupId: params.id, NOT: { userId: session.user.id } },
  })
  if (members.length > 0) {
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: 'CLASS_SCHEDULE_UPDATED',
        title: isFirstTime ? `Jadwal kelas tersedia: ${group?.name}` : `Jadwal diperbarui: ${group?.name}`,
        message: isFirstTime
          ? 'Komisaris baru saja menambahkan jadwal kuliah mingguan untuk kelas ini.'
          : 'Komisaris telah memperbarui jadwal kuliah mingguan kelas.',
        link: `/kelas/${params.id}`,
      })),
    })
  }

  const schedule = await db.classScheduleSlot.findMany({
    where: { groupId: params.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })

  return NextResponse.json(schedule.map((s) => ({ ...s, syncMode: 'LANGSUNG' })))
}
