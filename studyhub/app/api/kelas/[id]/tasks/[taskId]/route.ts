import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function getAdminMembership(userId: string, groupId: string) {
  return db.groupMember.findFirst({ where: { userId, groupId, role: 'ADMIN' } })
}

// PATCH: edit tugas kelas (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string; taskId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris' }, { status: 403 })

  const body = await req.json()
  const { title, description, deadline, priority, subject, status } = body

  const task = await db.classTask.update({
    where: { id: params.taskId, groupId: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(priority !== undefined && { priority }),
      ...(subject !== undefined && { subject: subject?.trim() || null }),
    },
  })

  void status // status tidak dipakai di ClassTask, ignore

  return NextResponse.json(task)
}

// DELETE: hapus tugas kelas (admin only)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; taskId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris' }, { status: 403 })

  await db.classTask.delete({ where: { id: params.taskId, groupId: params.id } })
  return NextResponse.json({ ok: true })
}
