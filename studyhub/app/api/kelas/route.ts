import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: list semua kelas user (sebagai admin atau member)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await db.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true, classTasks: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      subject: m.group.subject,
      inviteCode: m.group.inviteCode,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.group._count.members,
      taskCount: m.group._count.classTasks,
    })),
  )
}

// POST: buat kelas baru (user jadi komisaris/ADMIN otomatis)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, subject } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })

  const group = await db.group.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      subject: subject?.trim() || null,
      members: {
        create: {
          userId: session.user.id,
          role: 'ADMIN',
        },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  })

  await db.notification.create({
    data: {
      userId: session.user.id,
      type: 'CLASS_CREATED',
      title: 'Kelas berhasil dibuat',
      message: `Kelas "${group.name}" telah dibuat. Bagikan kode undangan ke anggota.`,
      link: `/kelas/${group.id}`,
    },
  })

  return NextResponse.json({
    id: group.id,
    name: group.name,
    description: group.description,
    subject: group.subject,
    inviteCode: group.inviteCode,
    role: 'ADMIN',
    memberCount: group._count.members,
    taskCount: 0,
  }, { status: 201 })
}
