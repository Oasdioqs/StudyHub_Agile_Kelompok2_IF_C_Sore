import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const notes = await db.note.findMany({
    where: {
      userId: session.user.id,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, tags } = await req.json()
  if (!title) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })

  const note = await db.note.create({
    data: {
      title,
      content: content ?? '',
      tags: tags ?? [],
      userId: session.user.id,
    },
  })

  await db.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 5 } },
  })

  return NextResponse.json(note, { status: 201 })
}
