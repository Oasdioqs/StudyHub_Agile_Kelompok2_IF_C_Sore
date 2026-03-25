// app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const task = await db.task.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  const wasNotDone = task.status !== 'DONE'
  const nowDone = body.status === 'DONE'

  const updated = await db.task.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.deadline !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.subject !== undefined && { subject: body.subject }),
    },
  })

  // Award 10 points when task is completed
  if (wasNotDone && nowDone) {
    await db.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 10 } },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await db.task.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!task) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  await db.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
