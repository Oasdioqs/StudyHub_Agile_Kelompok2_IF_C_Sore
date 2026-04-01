import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ── GET: detail PDF (summary + challenges) ────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    include: {
      challenges: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, question: true, answer: true, difficulty: true, sortOrder: true },
      },
    },
  })

  if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })

  const { extractedText: _, ...rest } = doc
  return NextResponse.json(rest)
}

// ── DELETE: soft-delete PDF (tidak kurangi lifetime counter) ──────────────────
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
  })
  if (!doc) return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 })

  // Soft delete: set deletedAt, jangan hapus record (lifetime counter tidak berkurang)
  await db.pdfDocument.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

// ── PATCH: update title PDF ────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title } = await req.json().catch(() => ({}))
  if (!title?.trim()) return NextResponse.json({ error: 'Judul tidak boleh kosong.' }, { status: 400 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!doc) return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 })

  const updated = await db.pdfDocument.update({
    where: { id: params.id },
    data: { title: title.trim() },
    select: { id: true, title: true },
  })
  return NextResponse.json(updated)
}
