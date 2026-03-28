import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const TASK_LIST_CONTEXT_PREFIX = '[TASK_LIST_CONTEXT]'
const TASK_PENDING_ACTION_PREFIX = '[TASK_PENDING_ACTION]'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let aiSession: any = null
  try {
    aiSession = await db.aISession.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: {
        id: true,
        title: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Riwayat belum bisa diakses saat ini.' }, { status: 503 })
  }

  if (!aiSession) {
    return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
  }

  const safeMessages = Array.isArray(aiSession.messages)
    ? aiSession.messages.filter(
        (m: any) =>
          !(
            m?.role === 'assistant' &&
            typeof m?.content === 'string' &&
            (m.content.startsWith(TASK_LIST_CONTEXT_PREFIX) ||
              m.content.startsWith(TASK_PENDING_ACTION_PREFIX))
          ),
      )
    : []

  return NextResponse.json({
    ...aiSession,
    messages: safeMessages,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const title = String(body?.title || '').trim()
  if (!title) {
    return NextResponse.json({ error: 'Nama chat wajib diisi.' }, { status: 400 })
  }

  try {
    const updated = await db.aISession.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: { title: title.slice(0, 80) },
    })
    if (!updated.count) {
      return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Gagal mengubah nama chat.' }, { status: 503 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deleted = await db.aISession.deleteMany({
      where: { id: params.id, userId: session.user.id },
    })
    if (!deleted.count) {
      return NextResponse.json({ error: 'Session tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus riwayat chat.' }, { status: 503 })
  }
}
