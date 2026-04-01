import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotificationWithPush } from '@/lib/notification-push'

// DELETE: komisaris keluarkan anggota dari kelas
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pastikan yang memanggil adalah komisaris
  const admin = await db.groupMember.findFirst({
    where: { userId: session.user.id, groupId: params.id, role: 'ADMIN' },
  })
  if (!admin) return NextResponse.json({ error: 'Hanya komisaris yang dapat mengeluarkan anggota' }, { status: 403 })

  // Cegah komisaris mengeluarkan dirinya sendiri atau komisaris lain
  const target = await db.groupMember.findFirst({
    where: { userId: params.memberId, groupId: params.id },
  })
  if (!target) return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 })
  if (target.userId === session.user.id) return NextResponse.json({ error: 'Tidak bisa mengeluarkan diri sendiri' }, { status: 400 })
  if (target.role === 'ADMIN') return NextResponse.json({ error: 'Tidak bisa mengeluarkan sesama komisaris' }, { status: 400 })

  await db.groupMember.delete({ where: { id: target.id } })

  // Notifikasi ke anggota yang dikeluarkan
  const group = await db.group.findUnique({ where: { id: params.id }, select: { name: true } })
  await createNotificationWithPush(params.memberId, {
    type: 'CLASS_KICKED',
    title: `Kamu dikeluarkan dari kelas ${group?.name}`,
    message: `Komisaris telah mengeluarkan kamu dari kelas "${group?.name}".`,
    link: `/kelas`,
  }, '/kelas')

  return NextResponse.json({ ok: true })
}
