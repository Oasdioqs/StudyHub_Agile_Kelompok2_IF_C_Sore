import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: ambil mode sesi untuk slot+tanggal
// Query: ?slotId=xxx&slotType=personal&date=2026-03-31
// Default: LANGSUNG (jika tidak ada record = default offline)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const slotId = searchParams.get('slotId')
  const slotType = searchParams.get('slotType') // "personal" | "class"
  const dateParam = searchParams.get('date')

  if (!slotId || !slotType || !dateParam) {
    return NextResponse.json({ error: 'slotId, slotType, date diperlukan' }, { status: 400 })
  }

  const date = new Date(dateParam)
  date.setUTCHours(0, 0, 0, 0)

  const record = await db.classSessionMode.findUnique({
    where: { slotId_slotType_date: { slotId, slotType, date } },
  })

  // Default LANGSUNG jika tidak ada record (record hanya dibuat saat MAYA)
  return NextResponse.json({ mode: record?.mode ?? 'LANGSUNG', record })
}

// POST: set mode sesi per tanggal
// Body: { slotId, slotType, date, mode: "MAYA" | "LANGSUNG", note?, groupId? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { slotId, slotType, date, mode, note, groupId } = body

  if (!slotId || !slotType || !date || !['MAYA', 'LANGSUNG'].includes(mode)) {
    return NextResponse.json({ error: 'slotId, slotType, date, mode wajib diisi' }, { status: 400 })
  }

  // Jika slotType class, cek apakah user adalah komisaris
  if (slotType === 'class' && groupId) {
    const admin = await db.groupMember.findFirst({
      where: { userId: session.user.id, groupId, role: 'ADMIN' },
    })
    if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengatur mode kelas' }, { status: 403 })
  }

  const normalizedDate = new Date(date)
  normalizedDate.setUTCHours(0, 0, 0, 0)

  if (mode === 'LANGSUNG') {
    // Jika ada note, simpan/update note di record yang ada — jangan hapus
    if (note !== undefined) {
      await db.classSessionMode.upsert({
        where: { slotId_slotType_date: { slotId, slotType, date: normalizedDate } },
        update: { note: note?.trim() || null },
        create: {
          slotId, slotType, date: normalizedDate, mode: 'LANGSUNG',
          note: note?.trim() || null, setById: session.user.id, groupId: groupId || null,
        },
      })
      return NextResponse.json({ mode: 'LANGSUNG' })
    }

    // Hapus record (kembali ke default LANGSUNG)
    await db.classSessionMode.deleteMany({
      where: { slotId, slotType, date: normalizedDate },
    })

    // Jika class + admin, hapus dan notifikasi anggota bahwa kembali ke luring
    if (slotType === 'class' && groupId) {
      const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } })
      const slot = await db.classScheduleSlot.findUnique({ where: { id: slotId }, select: { title: true } })
      const members = await db.groupMember.findMany({
        where: { groupId, NOT: { userId: session.user.id } },
      })
      if (members.length > 0) {
        await db.notification.createMany({
          data: members.map((m) => ({
            userId: m.userId,
            type: 'CLASS_MODE_CHANGED',
            title: `Mode kuliah diperbarui — ${group?.name}`,
            message: `${slot?.title ?? 'Kuliah'} pada ${new Date(normalizedDate).toLocaleDateString('id-ID')} kembali ke Sinkron Langsung (Luring).`,
            link: `/kelas/${groupId}`,
          })),
        })
      }
    }

    return NextResponse.json({ mode: 'LANGSUNG' })
  }

  // mode === 'MAYA'
  const record = await db.classSessionMode.upsert({
    where: { slotId_slotType_date: { slotId, slotType, date: normalizedDate } },
    update: { mode, note: note?.trim() || null, setById: session.user.id, groupId: groupId || null },
    create: {
      slotId,
      slotType,
      date: normalizedDate,
      mode,
      note: note?.trim() || null,
      setById: session.user.id,
      groupId: groupId || null,
    },
  })

  // Notifikasi anggota jika class mode
  if (slotType === 'class' && groupId) {
    const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } })
    const slot = await db.classScheduleSlot.findUnique({ where: { id: slotId }, select: { title: true } })
    const members = await db.groupMember.findMany({
      where: { groupId, NOT: { userId: session.user.id } },
    })
    if (members.length > 0) {
      await db.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          type: 'CLASS_MODE_CHANGED',
          title: `Mode kuliah berubah — ${group?.name}`,
          message: `${slot?.title ?? 'Kuliah'} pada ${new Date(normalizedDate).toLocaleDateString('id-ID')} diganti ke Sinkron Maya (Daring).${note ? ` Catatan: ${note}` : ''}`,
          link: `/kelas/${groupId}`,
        })),
      })
    }
  }

  return NextResponse.json({ mode: record.mode, record })
}
