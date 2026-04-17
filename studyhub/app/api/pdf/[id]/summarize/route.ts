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

  const text = doc.extractedText.slice(0, 45000)

  try {
    let summary = ''
    try {
      summary = await callAI(
        [
          {
            role: 'system',
            content:
              'Kamu adalah asisten akademik yang membuat ringkasan komprehensif. Padukan teks dengan penjelasan gambar/diagram bila tercantum di dokumen. Sertakan kode program jika ada.',
          },
          { role: 'user', content: buildSummaryPrompt(doc.title, text) },
        ],
        3600,
        52_000,
      )
    } catch (e) {
      console.error('summarize primary:', e)
    }
    if (!summary.trim()) {
      summary = await callAI(
        [
          {
            role: 'system',
            content:
              'Ringkas dokumen berikut dalam Bahasa Indonesia dengan markdown: ## Topik, ## Poin utama, ## Kesimpulan. Sertakan kode dalam code block jika ada.',
          },
          { role: 'user', content: text.slice(0, 38000) },
        ],
        2800,
        45_000,
      )
    }
    if (!summary.trim()) {
      return NextResponse.json({ error: 'Gagal membuat ringkasan. Coba lagi.' }, { status: 500 })
    }

    await db.pdfDocument.update({
      where: { id: params.id },
      data: { summary },
    })

    return NextResponse.json({ summary })
  } catch (e) {
    console.error('summarize route:', e)
    return NextResponse.json({ error: 'Gagal membuat ringkasan. Coba lagi.' }, { status: 500 })
  }
}
