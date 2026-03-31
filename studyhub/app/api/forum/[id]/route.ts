import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const thread = await db.thread.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      replies: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, name: true, image: true } },
          thread: { select: { id: true } },
        },
        orderBy: [{ isBestAnswer: 'desc' }, { upvotes: 'desc' }, { createdAt: 'asc' }],
      },
      _count: { select: { replies: true } },
    },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread tidak ditemukan' }, { status: 404 })
  }

  // Increment view count
  await db.thread.update({
    where: { id: params.id },
    data: { views: { increment: 1 } },
  })

  return NextResponse.json(thread)
}
