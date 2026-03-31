import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/forum/[id]/upvote — upvote thread
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thread = await db.thread.findUnique({ where: { id: params.id } })
  if (!thread) return NextResponse.json({ error: 'Thread tidak ditemukan' }, { status: 404 })

  const updated = await db.thread.update({
    where: { id: params.id },
    data: { upvotes: { increment: 1 } },
  })

  return NextResponse.json({ upvotes: updated.upvotes })
}
