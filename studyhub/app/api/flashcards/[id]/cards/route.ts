import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/flashcards/[id]/cards — tambah kartu ke set
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const set = await db.flashcardSet.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!set) return NextResponse.json({ error: 'Set tidak ditemukan' }, { status: 404 })

  const { question, answer } = await req.json()
  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: 'Pertanyaan dan jawaban wajib diisi' }, { status: 400 })
  }

  const card = await db.flashcard.create({
    data: {
      question: question.trim(),
      answer: answer.trim(),
      setId: params.id,
    },
  })

  return NextResponse.json(card, { status: 201 })
}

// DELETE /api/flashcards/[id]/cards?cardId=xxx — hapus kartu
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('cardId')
  if (!cardId) return NextResponse.json({ error: 'cardId wajib diisi' }, { status: 400 })

  // Verify ownership
  const card = await db.flashcard.findFirst({
    where: { id: cardId, setId: params.id },
    include: { set: { select: { userId: true } } },
  })
  if (!card || card.set.userId !== session.user.id) {
    return NextResponse.json({ error: 'Kartu tidak ditemukan' }, { status: 404 })
  }

  await db.flashcard.delete({ where: { id: cardId } })
  return NextResponse.json({ success: true })
}
