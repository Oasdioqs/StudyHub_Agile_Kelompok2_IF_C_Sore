import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: absensi user untuk rentang tanggal
// Query: ?date=2026-03-31  (atau ?from=&to= untuk range)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  let where: Record<string, unknown> = { userId: session.user.id }

  if (dateParam) {
    const d = new Date(dateParam)
    d.setUTCHours(0, 0, 0, 0)
    const nextDay = new Date(d)
    nextDay.setUTCDate(d.getUTCDate() + 1)
    where.date = { gte: d, lt: nextDay }
  } else if (fromParam && toParam) {
    const from = new Date(fromParam)
    from.setUTCHours(0, 0, 0, 0)
    const to = new Date(toParam)
    to.setUTCHours(23, 59, 59, 999)
    where.date = { gte: from, lte: to }
  }

  const records = await db.attendanceRecord.findMany({
    where,
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(records)
}

// POST/PATCH: upsert absensi (hadir/tidak hadir/sakit/izin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { slotId, slotType, date, status } = body

  if (!slotId || !slotType || !date || !status) {
    return NextResponse.json({ error: 'slotId, slotType, date, status wajib diisi' }, { status: 400 })
  }

  const validStatuses = ['HADIR', 'TIDAK_HADIR', 'SAKIT', 'IZIN']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }

  const normalizedDate = new Date(date)
  normalizedDate.setUTCHours(0, 0, 0, 0)

  const record = await db.attendanceRecord.upsert({
    where: {
      userId_slotId_slotType_date: {
        userId: session.user.id,
        slotId,
        slotType,
        date: normalizedDate,
      },
    },
    update: { status },
    create: {
      userId: session.user.id,
      slotId,
      slotType,
      date: normalizedDate,
      status,
    },
  })

  return NextResponse.json(record)
}
