// app/api/notes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const note = await db.note.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!note) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  return NextResponse.json(note)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const note = await db.note.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!note) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  const body = await req.json()
  const updated = await db.note.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.tags !== undefined && { tags: body.tags }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const note = await db.note.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!note) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  await db.note.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
