import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH: perbarui info kelas (hanya komisaris)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id, role: 'ADMIN' },
  })
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengubah pengaturan kelas' }, { status: 403 })

  const body = await req.json()
  const { name, description, subject } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })
  }

  const updated = await db.group.update({
    where: { id: params.id },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      subject: subject?.trim() || null,
    },
  })

  return NextResponse.json(updated)
}
