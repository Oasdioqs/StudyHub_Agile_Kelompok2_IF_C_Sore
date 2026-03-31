import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/flashcards — list semua set milik user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sets = await db.flashcardSet.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { flashcards: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sets)
}

// POST /api/flashcards — buat set baru
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, subject } = await req.json()
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Judul set wajib diisi' }, { status: 400 })
  }

  const set = await db.flashcardSet.create({
    data: {
      title: title.trim(),
      subject: subject?.trim() ?? null,
      userId: session.user.id,
    },
    include: {
      _count: { select: { flashcards: true } },
    },
  })

  // Award points
  await db.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 3 } },
  })

  return NextResponse.json(set, { status: 201 })
}
