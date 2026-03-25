// app/api/forum/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const sort = searchParams.get('sort') ?? 'latest'
  const search = searchParams.get('search')

  const threads = await db.thread.findMany({
    where: {
      ...(subject && { subject }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
      _count: { select: { replies: true } },
    },
    orderBy: sort === 'popular'
      ? { upvotes: 'desc' }
      : { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json(threads)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, subject, tags } = await req.json()
  if (!title || !content) {
    return NextResponse.json({ error: 'Judul dan isi wajib diisi' }, { status: 400 })
  }

  const thread = await db.thread.create({
    data: {
      title,
      content,
      subject: subject ?? null,
      tags: tags ?? [],
      userId: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  })

  return NextResponse.json(thread, { status: 201 })
}
