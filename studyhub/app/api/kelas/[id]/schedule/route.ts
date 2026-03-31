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

/**
 * Hitung tanggal konkret minggu ini untuk slot tertentu berdasarkan dayOfWeek.
 * dayOfWeek: 0=Minggu, 1=Senin, 2=Selasa, ..., 6=Sabtu (sama seperti JS getUTCDay)
 * Sehingga Senin minggu ini = today - today.getUTCDay() + 1, dst.
 */
function getSlotDate(dayOfWeek: number): Date {
  const today = new Date()
  const todayUTCDay = today.getUTCDay() // 0=Sun, 1=Mon, ...
  // Hitung offset dari hari ini ke dayOfWeek pada minggu yang sama
  // Gunakan Senin sebagai awal minggu
  const diffToMonday = todayUTCDay === 0 ? -6 : 1 - todayUTCDay
  const mondayMs = Date.UTC(
    today.getUTCFullYear(), today.getUTCMonth(),
    today.getUTCDate() + diffToMonday
  )
  // Offset dari Senin: Senin=0, Selasa=1, ..., Minggu=6
  const offsetFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  return new Date(mondayMs + offsetFromMonday * 86400000)
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

  // Ambil mode per slot menggunakan tanggal aktual masing-masing hari
  const sessionModeRecords = await Promise.all(
    schedule.map((slot) =>
      db.classSessionMode.findUnique({
        where: {
          slotId_slotType_date: {
            slotId: slot.id,
            slotType: 'class',
            date: getSlotDate(slot.dayOfWeek),
          },
        },
      })
    )
  )

  const result = schedule.map((s, i) => ({
    ...s,
    syncMode: sessionModeRecords[i]?.mode || 'LANGSUNG',
    liveMeetingUrl: sessionModeRecords[i]?.note || null,
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
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengatur jadwal' }, { status: 403 })

  const body = await req.json()

  // ─── Mode-only update (toggle sync mode per slot atau semua) ─────────────────
  if (body.syncMode && !body.slots) {
    const modeValue = body.syncMode === 'MAYA' ? 'MAYA' : 'LANGSUNG'
    const slotId = body.slotId // optional: update specific slot only

    // Ambil slot yang ditarget
    const targetSlots = await db.classScheduleSlot.findMany({
      where: slotId
        ? { id: slotId, groupId: params.id }
        : { groupId: params.id },
    })

    // Upsert mode menggunakan tanggal aktual masing-masing slot (dayOfWeek-based)
    for (const slot of targetSlots) {
      const slotDate = getSlotDate(slot.dayOfWeek)
      await db.classSessionMode.upsert({
        where: {
          slotId_slotType_date: {
            slotId: slot.id,
            slotType: 'class',
            date: slotDate,
          },
        },
        update: { mode: modeValue as 'MAYA' | 'LANGSUNG', setById: session.user.id },
        create: {
          slotId: slot.id,
          slotType: 'class',
          date: slotDate,
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

    // Kembalikan jadwal dengan mode terbaru (baca dari DB — semua slot)
    const updatedSchedule = await db.classScheduleSlot.findMany({
      where: { groupId: params.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    const allSessionModes = await Promise.all(
      updatedSchedule.map((slot) =>
        db.classSessionMode.findUnique({
          where: {
            slotId_slotType_date: {
              slotId: slot.id,
              slotType: 'class',
              date: getSlotDate(slot.dayOfWeek),
            },
          },
        })
      )
    )

    return NextResponse.json(
      updatedSchedule.map((s, i) => ({
        ...s,
        syncMode: allSessionModes[i]?.mode || 'LANGSUNG',
        liveMeetingUrl: allSessionModes[i]?.note || null,
      }))
    )
  }

  // ─── Live meeting URL only update ────────────────────────────────────────────
  if ('liveMeetingUrl' in body && body.slotId && !body.syncMode && !body.slots) {
    const slotId = body.slotId as string
    const liveMeetingUrl = typeof body.liveMeetingUrl === 'string' ? body.liveMeetingUrl.trim() : ''

    const slot = await db.classScheduleSlot.findFirst({ where: { id: slotId, groupId: params.id } })
    if (!slot) return NextResponse.json({ error: 'Slot tidak ditemukan' }, { status: 404 })

    const slotDate = getSlotDate(slot.dayOfWeek)

    await db.classSessionMode.upsert({
      where: { slotId_slotType_date: { slotId, slotType: 'class', date: slotDate } },
      update: { note: liveMeetingUrl || null },
      create: {
        slotId, slotType: 'class', date: slotDate,
        mode: 'LANGSUNG', note: liveMeetingUrl || null,
        setById: session.user.id, groupId: params.id,
      },
    })

    const updatedSchedule = await db.classScheduleSlot.findMany({
      where: { groupId: params.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    const allSessionModes = await Promise.all(
      updatedSchedule.map((s) =>
        db.classSessionMode.findUnique({
          where: { slotId_slotType_date: { slotId: s.id, slotType: 'class', date: getSlotDate(s.dayOfWeek) } },
        })
      )
    )

    return NextResponse.json(
      updatedSchedule.map((s, i) => ({
        ...s,
        syncMode: allSessionModes[i]?.mode || 'LANGSUNG',
        liveMeetingUrl: allSessionModes[i]?.note || null,
      }))
    )
  }

  // ─── Full schedule replacement (slots array) ──────────────────────────────────
  const slots: SlotInput[] = Array.isArray(body.slots) ? body.slots : []
  const validSlots = slots.filter(
    (s) => typeof s.title === 'string' && s.title.trim() &&
           typeof s.dayOfWeek === 'number' && s.dayOfWeek >= 0 && s.dayOfWeek <= 6
  )

  // Delete existing + recreate
  await db.classScheduleSlot.deleteMany({ where: { groupId: params.id } })

  const created = await Promise.all(
    validSlots.map((s) =>
      db.classScheduleSlot.create({
        data: {
          groupId: params.id,
          createdById: session.user.id,
          dayOfWeek: s.dayOfWeek,
          title: s.title.trim(),
          startTime: s.startTime?.trim() || '',
          endTime: s.endTime?.trim() || '',
          place: s.place?.trim() || '',
        },
      })
    )
  )

  return NextResponse.json(created.map((s) => ({ ...s, syncMode: 'LANGSUNG', liveMeetingUrl: null })))
}
