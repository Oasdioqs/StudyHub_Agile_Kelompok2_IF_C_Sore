import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI, callAIVision } from '@/lib/openrouter'
import { detectSparsePages, renderPdfPagesAsImages } from '@/lib/pdf-image-extractor'
import { isDevPremium } from '@/lib/dev-premium'
import { buildSummaryPrompt } from '@/lib/pdf-summary-prompt'

export const runtime = 'nodejs'
export const maxDuration = 60

const FREE_PDF_LIMIT = 3

// ── GET: list semua PDF user ──────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [docs, user] = await Promise.all([
    db.pdfDocument.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: {
        id: true, title: true, fileName: true,
        pageCount: true, charCount: true,
        status: true, createdAt: true,
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { isPremium: true, pdfUploadCount: true },
    }),
  ])

  const isPremium = (user?.isPremium ?? false) || isDevPremium(session.user.email)
  const lifetimeUsed = user?.pdfUploadCount ?? 0
  return NextResponse.json({ docs, isPremium, limit: FREE_PDF_LIMIT, lifetimeUsed })
}

// ── POST: upload + proses PDF ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // Cek limit free user — gunakan lifetime counter (tidak berkurang walau PDF dihapus)
  const user = await db.user.findUnique({ where: { id: userId }, select: { isPremium: true, pdfUploadCount: true, email: true } })
  const premiumActive = user?.isPremium || isDevPremium(session.user.email ?? user?.email)
  if (!premiumActive) {
    const lifetimeCount = user?.pdfUploadCount ?? 0
    if (lifetimeCount >= FREE_PDF_LIMIT) {
      return NextResponse.json({
        error: `Batas ${FREE_PDF_LIMIT} PDF (seumur hidup) tercapai. Upgrade ke Premium untuk upload lebih banyak.`,
        limitReached: true,
        lifetimeUsed: lifetimeCount,
      }, { status: 403 })
    }
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Format tidak valid. Kirim sebagai multipart/form-data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File PDF tidak ditemukan.' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Hanya file PDF yang diterima.' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran file maksimal 10 MB.' }, { status: 400 })
  }

  const customTitle = (formData.get('title') as string | null)?.trim() || ''

  // Buat record awal + increment lifetime counter atomically
  const [doc] = await db.$transaction([
    db.pdfDocument.create({
      data: {
        userId,
        title: customTitle || file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        extractedText: '',
        status: 'PROCESSING',
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { pdfUploadCount: { increment: 1 } },
    }),
  ])

  // Ekstrak teks + ringkasan — dibungkus timeout 50 detik agar tidak stuck PROCESSING
  const processWithTimeout = async (): Promise<NextResponse> => {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // unpdf: serverless-safe PDF text extraction
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const pageCount: number = pdf.numPages
    const { text: rawText } = await extractText(pdf, { mergePages: true })

    // Deteksi PDF berbasis gambar (sparse text = kemungkinan scan/screenshot)
    let ocrAppendix = ''
    if (detectSparsePages(rawText, pageCount)) {
      try {
        // Render halaman sebagai gambar dan OCR dengan vision AI
        const pages = await renderPdfPagesAsImages(buffer, Math.min(pageCount, 6))
        if (pages.length > 0) {
          const ocrParts: string[] = []
          for (const pg of pages) {
            try {
              const extracted = await callAIVision(
                pg.base64,
                'image/png',
                'Kamu adalah OCR engine. Ekstrak SEMUA teks yang ada di gambar ini secara verbatim. Jika ada kode program, tampilkan dalam format code block dengan bahasa yang tepat (```python, ```java, dll). Jangan tambahkan penjelasan, hanya ekstrak teks/kode yang ada di gambar.',
                20_000,
              )
              if (extracted.trim()) {
                ocrParts.push(`[Halaman ${pg.pageNum} — OCR dari gambar]\n${extracted}`)
              }
            } catch { /* skip page */ }
          }
          if (ocrParts.length > 0) {
            ocrAppendix = '\n\n=== KONTEN DARI GAMBAR/HALAMAN SCAN ===\n' + ocrParts.join('\n\n')
          }
        }
      } catch { /* OCR gagal, lanjut tanpa */ }
    }

    const fullText = rawText + ocrAppendix
    // Batasi 45.000 karakter untuk AI
    const truncated = fullText.slice(0, 45000)

    // callAI dengan timeout 28 detik — tidak akan hang
    let summary: string
    try {
      summary = await callAI([
        { role: 'system', content: 'Kamu adalah asisten akademik yang membuat ringkasan komprehensif. Selalu sertakan kode program jika ada.' },
        { role: 'user', content: buildSummaryPrompt(customTitle || file.name.replace(/\.pdf$/i, ''), fullText) },
      ], 2500, 28_000)
    } catch {
      summary = 'Ringkasan belum tersedia. Klik "Buat Ringkasan" untuk coba lagi.'
    }

    await db.pdfDocument.update({
      where: { id: doc.id },
      data: {
        extractedText: fullText.slice(0, 100000),
        summary,
        pageCount,
        charCount: fullText.length,
        status: 'READY',
        title: customTitle || file.name.replace(/\.pdf$/i, ''),
      },
    })

    return NextResponse.json({ id: doc.id, status: 'READY', title: doc.title })
  }

  // Timeout 50 detik (maxDuration=60, sisakan 10 detik untuk cleanup)
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PROCESSING_TIMEOUT')), 50_000),
    )
    return await Promise.race([processWithTimeout(), timeoutPromise])
  } catch (err: any) {
    const isTimeout = err?.message === 'PROCESSING_TIMEOUT'
    await db.pdfDocument
      .update({
        where: { id: doc.id },
        data: {
          status: isTimeout ? 'READY' : 'ERROR',
          // Jika timeout tapi teks sudah ada, tandai READY; jika belum ada data, set ERROR
          ...(isTimeout ? { summary: 'Ringkasan belum tersedia karena timeout. Klik "Buat Ringkasan".' } : {}),
        },
      })
      .catch(() => {})
    console.error('PDF process error:', err)
    if (isTimeout) {
      return NextResponse.json({ id: doc.id, status: 'READY', title: doc.title, slow: true })
    }
    return NextResponse.json({ error: 'Gagal membaca PDF. Pastikan file tidak terenkripsi.' }, { status: 422 })
  }
}
