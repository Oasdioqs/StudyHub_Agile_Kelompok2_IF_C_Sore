import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI } from '@/lib/openrouter'
import { buildSummaryPrompt } from '@/lib/pdf-summary-prompt'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, extractedText: true, status: true, title: true },
  })

  if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  if (doc.status !== 'READY') return NextResponse.json({ error: 'Dokumen belum siap.' }, { status: 400 })
  if (!doc.extractedText) return NextResponse.json({ error: 'Teks PDF kosong.' }, { status: 400 })

  try {
    const summary = await callAI([
      { role: 'system', content: 'Kamu adalah asisten akademik yang membuat ringkasan komprehensif. Selalu sertakan kode program jika ada.' },
      { role: 'user', content: buildSummaryPrompt(doc.title, doc.extractedText) },
    ], 2500, 50_000)

    await db.pdfDocument.update({
      where: { id: params.id },
      data: { summary },
    })

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'Gagal membuat ringkasan. Coba lagi.' }, { status: 500 })
  }
}
