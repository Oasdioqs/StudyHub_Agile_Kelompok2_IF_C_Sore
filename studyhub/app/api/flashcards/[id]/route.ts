import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/flashcards/[id] — detail set + semua kartu
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await db.flashcardSet.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { flashcards: { orderBy: { difficulty: 'asc' } } },
  })

  if (!set) return NextResponse.json({ error: 'Set tidak ditemukan' }, { status: 404 })

  return NextResponse.json(set)
}

// PATCH /api/flashcards/[id] — update judul/subject set
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, subject } = await req.json()

  const set = await db.flashcardSet.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!set) return NextResponse.json({ error: 'Set tidak ditemukan' }, { status: 404 })

  const updated = await db.flashcardSet.update({
    where: { id: params.id },
    data: {
      ...(title && { title: title.trim() }),
      ...(subject !== undefined && { subject: subject?.trim() ?? null }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/flashcards/[id] — hapus set + semua kartu
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await db.flashcardSet.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!set) return NextResponse.json({ error: 'Set tidak ditemukan' }, { status: 404 })

  await db.flashcardSet.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
