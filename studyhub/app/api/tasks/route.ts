import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserIdFromRequest } from '@/lib/api-session'
import { db } from '@/lib/db'
import { createNotificationWithPush } from '@/lib/notification-push'

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi').max(255),
  description: z.string().max(2000).optional(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  subject: z.string().max(100).optional(),
})

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const q = searchParams.get('q')?.trim()

  const where = {
    userId,
    ...(status && { status: status as any }),
    ...(priority && { priority: priority as any }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { subject: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }

  let tasks: any[] = []
  try {
    tasks = await db.task.findMany({
      where,
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    })
  } catch {
    return NextResponse.json([], { status: 200 })
  }

  // Ambil class tasks (best-effort; jangan gagalkan list task personal).
  let classTasksRaw: any[] = []
  try {
    const memberships = await db.groupMember.findMany({
      where: { userId },
      select: { groupId: true, group: { select: { name: true } } }
    })
    const groupIds = memberships.map(m => m.groupId)
    if (groupIds.length > 0) {
      classTasksRaw = await db.classTask.findMany({
        where: {
          groupId: { in: groupIds },
          ...(priority && { priority: priority as any }),
          ...(q && {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { subject: { contains: q, mode: 'insensitive' as const } },
            ],
          }),
        },
        include: { group: { select: { name: true } } },
        orderBy: [
          { deadline: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      })
    }
  } catch {}

  // Format sebagai class task (immutable tasks list)
  const classTasks = classTasksRaw.map((ct: any) => ({
    id: ct.id,
    title: `${ct.title} (${ct.group.name})`,
    description: ct.description,
    deadline: ct.deadline,
    priority: ct.priority,
    status: 'TODO', // Default status for class tasks
    subject: ct.subject,
    userId: userId, // Mocked for frontend compatibility
    createdAt: ct.createdAt,
    updatedAt: ct.updatedAt,
    isClassTask: true,
    groupId: ct.groupId
  }))

  const merged = [...tasks, ...classTasks].sort((a, b) => {
    const d1 = a.deadline ? new Date(a.deadline).getTime() : 0
    const d2 = b.deadline ? new Date(b.deadline).getTime() : 0
    return d1 - d2
  })

  return NextResponse.json(merged)
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json().catch(() => null)
  const parsed = CreateTaskSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { title, description, deadline, priority, subject } = parsed.data

  const [task] = await db.$transaction([
    db.task.create({
      data: {
        title,
        description,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority ?? 'MEDIUM',
        subject,
        userId,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { points: { increment: 2 } },
    }),
  ])

  await createNotificationWithPush(userId, {
    type: 'TASK_CREATED',
    title: 'Tugas baru ditambahkan',
    message: `Tugas "${title}" berhasil ditambahkan${deadline ? ` (deadline ${new Date(deadline).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })})` : ''}.`,
    link: '/tasks',
  })

  return NextResponse.json(task, { status: 201 })
}
