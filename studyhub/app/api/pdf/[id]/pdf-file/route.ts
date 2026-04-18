import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Serve PDF file for preview
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: { id: true, fileName: true, summaryFigures: true },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  }

  // summaryFigures contains blob URL
  const blobUrl = doc.summaryFigures as string | null

  if (!blobUrl) {
    return NextResponse.json(
      { error: 'File PDF tidak tersedia untuk preview. Upload ulang dokumen.' },
      { status: 404 }
    )
  }

  try {
    const response = await fetch(blobUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: 'File PDF tidak bisa diakses. Coba upload ulang.' },
        { status: 404 }
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.fileName}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('PDF serve error:', err)
    return NextResponse.json(
      { error: 'Gagal memuat file PDF.' },
      { status: 500 }
    )
  }
}
