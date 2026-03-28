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
  const q = searchParams.get('q')?.trim()

  const tasks = await db.task.findMany({
    where: {
      userId: session.user.id,
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { subject: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    },
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, deadline, priority, subject } = body

  if (!title) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })

  const [task] = await db.$transaction([
    db.task.create({
      data: {
        title,
        description,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority ?? 'MEDIUM',
        subject,
        userId: session.user.id,
      },
    }),
    db.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 2 } },
    }),
    db.notification.create({
      data: {
        userId: session.user.id,
        type: 'TASK_CREATED',
        title: 'Tugas baru ditambahkan',
        message: `Tugas "${title}" berhasil ditambahkan${deadline ? ` (deadline ${new Date(deadline).toLocaleString('id-ID')})` : ''}.`,
        link: '/tasks',
      },
    }),
  ])

  return NextResponse.json(task, { status: 201 })
}
