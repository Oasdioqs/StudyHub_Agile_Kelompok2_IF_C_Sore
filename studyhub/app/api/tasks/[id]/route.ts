import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-session'
import { db } from '@/lib/db'
import { createNotificationWithPush } from '@/lib/notification-push'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const existingTask = await db.task.findFirst({
    where: { id: params.id, userId },
    select: { id: true, status: true, title: true, deadline: true },
  })
  if (!existingTask) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  // Validate deadline format if provided
  if (body.deadline !== undefined && body.deadline !== null) {
    const parsed = new Date(body.deadline)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 })
    }
    body.deadline = parsed
  }

  const wasNotDone = existingTask.status !== 'DONE'
  const nowDone = body.status === 'DONE'

  let updated: any
  if (wasNotDone && nowDone) {
    const nextDeadline = body.deadline !== undefined
      ? body.deadline
      : existingTask.deadline
    const completedLate = !!nextDeadline && Date.now() > nextDeadline.getTime()
    const notifTitle = completedLate ? 'Tugas selesai, tapi telat' : 'Tugas selesai tepat waktu'
    const notifMessage = completedLate
      ? `Kamu menyelesaikan "${body.title ?? existingTask.title}" lewat deadline. Tetap semangat, kamu bisa lebih baik!`
      : `Mantap! "${body.title ?? existingTask.title}" selesai tepat waktu. Pertahankan ritme belajarmu!`

    const [taskUpdated] = await db.$transaction([
      db.task.update({
        where: { id: existingTask.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.deadline !== undefined && { deadline: nextDeadline }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.subject !== undefined && { subject: body.subject }),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { points: { increment: 10 } },
      }),
    ])
    await createNotificationWithPush(userId, {
      type: completedLate ? 'TASK_COMPLETED_LATE' : 'TASK_COMPLETED',
      title: notifTitle,
      message: notifMessage,
      link: '/tasks',
    })
    updated = taskUpdated
  } else {
    updated = await db.task.update({
      where: { id: existingTask.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.deadline !== undefined && { deadline: body.deadline }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.subject !== undefined && { subject: body.subject }),
      },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const task = await db.task.findFirst({
    where: { id: params.id, userId },
  })
  if (!task) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

  await db.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
