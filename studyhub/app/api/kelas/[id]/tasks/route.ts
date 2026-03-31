import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function getAdminMembership(userId: string, groupId: string) {
  return db.groupMember.findFirst({ where: { userId, groupId, role: 'ADMIN' } })
}
async function getMembership(userId: string, groupId: string) {
  return db.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } })
}

// GET: list tugas kelas
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = await getMembership(session.user.id, params.id)
  if (!membership) return NextResponse.json({ error: 'Tidak ada akses' }, { status: 403 })

  const tasks = await db.classTask.findMany({
    where: { groupId: params.id },
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  return NextResponse.json(tasks)
}

// POST: komisaris tambah tugas kelas → notifikasi ke semua anggota
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getAdminMembership(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat menambah tugas' }, { status: 403 })

  const body = await req.json()
  const { title, description, deadline, priority, subject } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })

  const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
  const task = await db.classTask.create({
    data: {
      groupId: params.id,
      title: title.trim(),
      description: description?.trim() || null,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority ?? 'MEDIUM',
      subject: subject?.trim() || null,
      createdById: session.user.id,
    },
  })

  // Notifikasi ke semua anggota
  const members = await db.groupMember.findMany({
    where: { groupId: params.id, NOT: { userId: session.user.id } },
  })
  if (members.length > 0) {
    await db.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: 'CLASS_TASK_ADDED',
        title: `Tugas baru: ${group?.name}`,
        message: `Komisaris menambahkan tugas "${task.title}"${task.deadline ? ` (deadline ${new Date(task.deadline).toLocaleDateString('id-ID')})` : ''}.`,
        link: `/kelas/${params.id}`,
      })),
    })
  }

  return NextResponse.json(task, { status: 201 })
}
