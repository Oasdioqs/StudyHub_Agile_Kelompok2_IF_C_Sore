// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')

  const tasks = await db.task.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
    },
    orderBy: [{ priority: 'asc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, deadline, priority, subject } = body

  if (!title) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })

  const task = await db.task.create({
    data: {
      title,
      description,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority ?? 'MEDIUM',
      subject,
      userId: session.user.id,
    },
  })

  // Award points for creating a task
  await db.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 2 } },
  })

  return NextResponse.json(task, { status: 201 })
}
