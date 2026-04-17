import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { inferDocumentKind } from '@/lib/document-kind'
import { callAI } from '@/lib/openrouter'
import { buildFullVersionPrompt } from '@/lib/pdf-full-version-prompt'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      extractedText: true,
      status: true,
      title: true,
      fileName: true,
      pageCount: true,
    },
  })

  if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  if (doc.status !== 'READY') return NextResponse.json({ error: 'Dokumen belum siap.' }, { status: 400 })
  if (!doc.extractedText?.trim()) return NextResponse.json({ error: 'Teks dokumen kosong.' }, { status: 400 })

  const kind = inferDocumentKind(doc.fileName)
  const userContent = buildFullVersionPrompt(doc.title, kind, doc.pageCount, doc.extractedText)

  try {
    let summaryFull = ''
    try {
      summaryFull = await callAI(
        [
          {
            role: 'system',
            content:
              'Kamu menulis penjelajar akademik lengkap per halaman/slide dalam Bahasa Indonesia. Utamakan kelengkapan dan kejelasan; gunakan markdown (##, ###, list, code block). Jangan menambah fakta di luar sumber.',
          },
          { role: 'user', content: userContent },
        ],
        6500,
        54_000,
      )
    } catch (e) {
      console.error('full-version primary:', e)
    }

    if (!summaryFull.trim()) {
      summaryFull = await callAI(
        [
          {
            role: 'system',
            content:
              'Jelaskan seluruh dokumen berikut dalam Bahasa Indonesia, per bagian berurutan dengan heading ## untuk setiap bagian/halaman/slide. Markdown saja.',
          },
          {
            role: 'user',
            content: doc.extractedText.slice(0, 55_000),
          },
        ],
        5500,
        48_000,
      )
    }

    if (!summaryFull.trim()) {
      return NextResponse.json({ error: 'Gagal membuat versi lengkap. Coba lagi.' }, { status: 500 })
    }

    await db.pdfDocument.update({
      where: { id: params.id },
      data: { summaryFull },
    })

    return NextResponse.json({ summaryFull })
  } catch (e) {
    console.error('full-version route:', e)
    return NextResponse.json({ error: 'Gagal membuat versi lengkap. Coba lagi.' }, { status: 500 })
  }
}
