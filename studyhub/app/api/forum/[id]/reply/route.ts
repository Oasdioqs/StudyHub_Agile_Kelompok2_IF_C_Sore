import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/forum/[id]/reply — tambah reply ke thread
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, parentId } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Konten reply wajib diisi' }, { status: 400 })
  }

  // Verify thread exists
  const thread = await db.thread.findUnique({ where: { id: params.id } })
  if (!thread) return NextResponse.json({ error: 'Thread tidak ditemukan' }, { status: 404 })

  const reply = await db.reply.create({
    data: {
      content: content.trim(),
      threadId: params.id,
      userId: session.user.id,
      parentId: parentId ?? null,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
      thread: { select: { id: true } },
    },
  })

  return NextResponse.json(reply, { status: 201 })
}

// PATCH /api/forum/[id]/reply — upvote reply atau mark best answer
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { replyId, action } = await req.json()
  if (!replyId || !action) {
    return NextResponse.json({ error: 'replyId dan action wajib diisi' }, { status: 400 })
  }

  const reply = await db.reply.findUnique({ where: { id: replyId } })
  if (!reply) return NextResponse.json({ error: 'Reply tidak ditemukan' }, { status: 404 })

  if (action === 'upvote') {
    const updated = await db.reply.update({
      where: { id: replyId },
      data: { upvotes: { increment: 1 } },
    })
    return NextResponse.json(updated)
  }

  if (action === 'best_answer') {
    // Hanya pemilik thread yang bisa mark best answer
    const thread = await db.thread.findUnique({ where: { id: params.id } })
    if (thread?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Hanya pemilik thread yang bisa memilih Best Answer' }, { status: 403 })
    }

    // Reset best answer lain di thread ini
    await db.reply.updateMany({
      where: { threadId: params.id, isBestAnswer: true },
      data: { isBestAnswer: false },
    })

    const updated = await db.reply.update({
      where: { id: replyId },
      data: { isBestAnswer: true },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 })
}
