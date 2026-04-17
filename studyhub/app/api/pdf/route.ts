import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { del } from '@vercel/blob'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI, callAIVision } from '@/lib/openrouter'
import { detectSparsePages, renderPdfPagesAsImages } from '@/lib/pdf-image-extractor'
import {
  BLOB_STAGING_MAX_BYTES,
  inferDocumentKind,
  isBlobUploadConfigured,
  maxDocumentUploadBytes,
  maxDocumentUploadLabel,
} from '@/lib/document-kind'
import { isDevPremium } from '@/lib/dev-premium'
import { buildSummaryPrompt } from '@/lib/pdf-summary-prompt'
import {
  analyzeOfficeRastersForDoc,
  extractEmbeddedRasters,
  MARKER_PDF_SCAN,
  PDF_PAGE_OCR_AND_VISUAL_PROMPT,
} from '@/lib/document-visual-enrichment'
import { uploadSummaryFigureFromBuffer, type SummaryFigure } from '@/lib/summary-figure-blob'

export const runtime = 'nodejs'
/** Hobby Vercel max 60s; parallel vision PDF agar ringkasan sempat jalan. */
export const maxDuration = 60

const FREE_PDF_LIMIT = 3

type FileKind = 'pdf' | 'docx' | 'pptx'

function detectFileKind(file: File): FileKind | null {
  const n = file.name.toLowerCase()
  const t = (file.type || '').toLowerCase()
  if (n.endsWith('.pdf') || t === 'application/pdf') return 'pdf'
  if (n.endsWith('.docx') || t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (n.endsWith('.pptx') || t === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx'
  if (n.endsWith('.doc') || t === 'application/msword') return null // legacy — ditolak eksplisit
  if (n.endsWith('.ppt') || t === 'application/vnd.ms-powerpoint') return null
  return null
}

function stripOfficeExt(name: string): string {
  return name.replace(/\.(pdf|docx|pptx)$/i, '')
}

function detectFileKindFromName(fileName: string, mimeType?: string | null): FileKind | null {
  return detectFileKind({ name: fileName, type: mimeType ?? '' } as File)
}

function isAllowedVercelBlobUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    return (
      u.hostname.endsWith('.public.blob.vercel-storage.com') ||
      u.hostname === 'public.blob.vercel-storage.com'
    )
  } catch {
    return false
  }
}

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
  const docsOut = docs.map((d) => ({ ...d, fileKind: inferDocumentKind(d.fileName) }))
  const blobUpload = isBlobUploadConfigured()
  return NextResponse.json({
    docs: docsOut,
    isPremium,
    limit: FREE_PDF_LIMIT,
    lifetimeUsed,
    blobUpload,
    maxLargeUploadBytes: blobUpload ? BLOB_STAGING_MAX_BYTES : maxDocumentUploadBytes(),
    maxFormUploadBytes: maxDocumentUploadBytes(),
  })
}

async function processDocumentFromBuffer(params: {
  doc: { id: string; title: string }
  buffer: Buffer
  fileKind: FileKind
  baseTitle: string
}): Promise<NextResponse> {
  const { doc, buffer, fileKind, baseTitle } = params
  let fullText = ''
  let pageCount = 0
  const figures: SummaryFigure[] = []

  if (fileKind === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    pageCount = pdf.numPages
    const { text: rawText } = await extractText(pdf, { mergePages: true })

    let ocrAppendix = ''
    if (detectSparsePages(rawText, pageCount)) {
      try {
        const pages = await renderPdfPagesAsImages(buffer, Math.min(pageCount, 4))
        if (pages.length > 0) {
          const PDF_VISION_BATCH = 4
          const ocrByPage: { pageNum: number; text: string }[] = []
          for (let start = 0; start < pages.length; start += PDF_VISION_BATCH) {
            const chunk = pages.slice(start, start + PDF_VISION_BATCH)
            const chunkResults = await Promise.all(
              chunk.map(async (pg) => {
                try {
                  const extracted = await callAIVision(
                    pg.base64,
                    'image/png',
                    PDF_PAGE_OCR_AND_VISUAL_PROMPT,
                    12_000,
                    1600,
                  )
                  return { pageNum: pg.pageNum, extracted: extracted.trim() }
                } catch {
                  return { pageNum: pg.pageNum, extracted: '' }
                }
              }),
            )
            for (let i = 0; i < chunkResults.length; i++) {
              const { pageNum, extracted } = chunkResults[i]
              const pngBuf = Buffer.from(chunk[i].base64, 'base64')
              const figUrl = await uploadSummaryFigureFromBuffer(doc.id, figures.length, pngBuf, 'image/png')
              if (figUrl) {
                figures.push({ url: figUrl, caption: `Halaman PDF ${pageNum}` })
              }
              if (extracted) {
                ocrByPage.push({ pageNum, text: `[Halaman ${pageNum} — teks & analisis visual]\n${extracted}` })
              }
            }
          }
          ocrByPage.sort((a, b) => a.pageNum - b.pageNum)
          if (ocrByPage.length > 0) {
            ocrAppendix = `\n\n${MARKER_PDF_SCAN}\n` + ocrByPage.map((x) => x.text).join('\n\n')
          }
        }
      } catch { /* OCR gagal */ }
    }
    fullText = rawText + ocrAppendix
  } else if (fileKind === 'docx') {
    try {
      const { extractDocxText } = await import('@/lib/office-docx')
      const { text } = await extractDocxText(buffer)
      fullText = text
      pageCount = 0
    } catch (e) {
      console.error('DOCX extract error:', e)
      await db.pdfDocument.update({
        where: { id: doc.id },
        data: { status: 'ERROR', summary: 'Gagal membaca file Word.' },
      })
      return NextResponse.json({ error: 'Gagal membaca Word (.docx). File mungkin rusak atau terproteksi.' }, { status: 422 })
    }
    try {
      const rasters = await extractEmbeddedRasters(buffer, 'docx')
      const { appendix, galleryRasters } = await analyzeOfficeRastersForDoc(rasters)
      for (let i = 0; i < galleryRasters.length; i++) {
        const r = galleryRasters[i]
        const buf = Buffer.from(r.base64, 'base64')
        const figUrl = await uploadSummaryFigureFromBuffer(doc.id, figures.length, buf, r.mime)
        if (figUrl) {
          figures.push({
            url: figUrl,
            caption: `Materi (ringkasan): gambar ${i + 1} (${r.label.replace(/[()[\]]/g, ' ')})`,
          })
        }
      }
      if (appendix) fullText = fullText.trim() ? `${fullText}\n\n${appendix}` : appendix
    } catch { /* visual opsional */ }
  } else {
    try {
      const { extractPptxText } = await import('@/lib/office-pptx')
      const { text, slideCount } = await extractPptxText(buffer)
      fullText = text
      pageCount = slideCount
    } catch (e) {
      console.error('PPTX extract error:', e)
      await db.pdfDocument.update({
        where: { id: doc.id },
        data: { status: 'ERROR', summary: 'Gagal membaca PowerPoint.' },
      })
      return NextResponse.json({
        error: 'Gagal membaca PowerPoint (.pptx). Coba buka di PowerPoint → Simpan sebagai .pptx baru, atau ekspor ke PDF lalu upload PDF.',
      }, { status: 422 })
    }
    try {
      const rasters = await extractEmbeddedRasters(buffer, 'pptx')
      const { appendix, galleryRasters } = await analyzeOfficeRastersForDoc(rasters)
      for (let i = 0; i < galleryRasters.length; i++) {
        const r = galleryRasters[i]
        const buf = Buffer.from(r.base64, 'base64')
        const figUrl = await uploadSummaryFigureFromBuffer(doc.id, figures.length, buf, r.mime)
        if (figUrl) {
          figures.push({
            url: figUrl,
            caption: `Materi (ringkasan): slide/gambar ${i + 1} (${r.label.replace(/[()[\]]/g, ' ')})`,
          })
        }
      }
      if (appendix) fullText = fullText.trim() ? `${fullText}\n\n${appendix}` : appendix
    } catch { /* visual opsional */ }
  }

  if (!fullText.trim() || fullText.trim().length < 20) {
    await db.pdfDocument.update({
      where: { id: doc.id },
      data: { status: 'ERROR', summary: 'Tidak ada teks yang bisa diekstrak. Pastikan file berisi teks (bukan hanya gambar kosong).' },
    })
    return NextResponse.json({ error: 'Tidak ada teks yang bisa diekstrak dari file ini.' }, { status: 422 })
  }

  const textForAi = fullText.slice(0, 45000)

  let summary = ''
  const summaryMessages: { role: string; content: string }[] = [
    {
      role: 'system',
      content:
        'Kamu adalah asisten akademik yang membuat ringkasan komprehensif. Wajib memadukan teks dengan penjelasan gambar/diagram bila ada. Sertakan kode program jika ada.',
    },
    { role: 'user', content: buildSummaryPrompt(baseTitle, textForAi) },
  ]
  try {
    summary = await callAI(summaryMessages, 3200, 42_000)
  } catch (e) {
    console.error('PDF summary (primary) failed:', e)
  }
  if (!summary.trim()) {
    try {
      summary = await callAI(
        [
          {
            role: 'system',
            content:
              'Ringkas dokumen berikut dalam Bahasa Indonesia dengan markdown: ## Topik, ## Poin utama (bullet), ## Kesimpulan. Sertakan kode dalam code block jika ada.',
          },
          { role: 'user', content: textForAi.slice(0, 38000) },
        ],
        2800,
        36_000,
      )
    } catch (e) {
      console.error('PDF summary (fallback) failed:', e)
    }
  }
  if (!summary.trim()) {
    summary = 'Ringkasan belum tersedia. Klik "Buat Ringkasan" untuk coba lagi.'
  }

  await db.pdfDocument.update({
    where: { id: doc.id },
    data: {
      extractedText: fullText.slice(0, 100000),
      summary,
      summaryFigures: figures.length > 0 ? (figures as Prisma.InputJsonValue) : Prisma.JsonNull,
      pageCount,
      charCount: fullText.length,
      status: 'READY',
      title: baseTitle,
    },
  })

  return NextResponse.json({ id: doc.id, status: 'READY', title: doc.title })
}

async function runProcessingWithTimeout(
  doc: { id: string; title: string },
  buffer: Buffer,
  fileKind: FileKind,
  baseTitle: string,
): Promise<NextResponse> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PROCESSING_TIMEOUT')), 57_000),
    )
    return await Promise.race([
      processDocumentFromBuffer({ doc, buffer, fileKind, baseTitle }),
      timeoutPromise,
    ])
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.message === 'PROCESSING_TIMEOUT'
    await db.pdfDocument
      .update({
        where: { id: doc.id },
        data: {
          status: isTimeout ? 'READY' : 'ERROR',
          ...(isTimeout ? { summary: 'Ringkasan belum tersedia karena timeout. Klik "Buat Ringkasan".' } : {}),
        },
      })
      .catch(() => {})
    console.error('PDF process error:', err)
    if (isTimeout) {
      return NextResponse.json({ id: doc.id, status: 'READY', title: doc.title, slow: true })
    }
    return NextResponse.json({ error: 'Gagal membaca dokumen. Pastikan file tidak rusak atau terenkripsi.' }, { status: 422 })
  }
}

// ── POST: upload + proses PDF ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const user = await db.user.findUnique({ where: { id: userId }, select: { isPremium: true, pdfUploadCount: true, email: true } })
  const premiumActive = user?.isPremium || isDevPremium(session.user.email ?? user?.email)
  if (!premiumActive) {
    const lifetimeCount = user?.pdfUploadCount ?? 0
    if (lifetimeCount >= FREE_PDF_LIMIT) {
      return NextResponse.json({
        error: `Batas ${FREE_PDF_LIMIT} dokumen (seumur hidup) tercapai. Upgrade ke Premium untuk upload lebih banyak.`,
        limitReached: true,
        lifetimeUsed: lifetimeCount,
      }, { status: 403 })
    }
  }

  const isJson = (req.headers.get('content-type') || '').includes('application/json')

  if (isJson) {
    if (!isBlobUploadConfigured()) {
      return NextResponse.json(
        { error: 'Upload file besar membutuhkan Vercel Blob (BLOB_READ_WRITE_TOKEN).' },
        { status: 400 },
      )
    }

    let body: { fromBlobUrl?: string; fileName?: string; title?: string; mimeType?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const fromBlobUrl = typeof body.fromBlobUrl === 'string' ? body.fromBlobUrl.trim() : ''
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
    const customTitle = typeof body.title === 'string' ? body.title.trim() : ''
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : undefined

    if (!fromBlobUrl || !fileName) {
      return NextResponse.json({ error: 'fromBlobUrl dan fileName wajib diisi.' }, { status: 400 })
    }
    if (!isAllowedVercelBlobUrl(fromBlobUrl)) {
      return NextResponse.json({ error: 'URL penyimpanan sementara tidak valid.' }, { status: 400 })
    }

    const fileKind = detectFileKindFromName(fileName, mimeType)
    if (fileKind === null) {
      const n = fileName.toLowerCase()
      if (n.endsWith('.doc') || n.endsWith('.ppt')) {
        return NextResponse.json({
          error: 'Format .doc / .ppt (lama) tidak didukung. Simpan sebagai .docx atau .pptx lalu upload lagi.',
        }, { status: 400 })
      }
      return NextResponse.json({
        error: 'Hanya PDF, Word (.docx), atau PowerPoint (.pptx) yang diterima.',
      }, { status: 400 })
    }

    const baseTitle = customTitle || stripOfficeExt(fileName)

    const [doc] = await db.$transaction([
      db.pdfDocument.create({
        data: {
          userId,
          title: baseTitle,
          fileName,
          extractedText: '',
          status: 'PROCESSING',
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { pdfUploadCount: { increment: 1 } },
      }),
    ])

    let buffer: Buffer
    try {
      const fetchRes = await fetch(fromBlobUrl, { signal: AbortSignal.timeout(180_000) })
      if (!fetchRes.ok) {
        await db.pdfDocument.update({
          where: { id: doc.id },
          data: { status: 'ERROR', summary: 'Gagal mengambil file dari penyimpanan sementara.' },
        })
        await del(fromBlobUrl).catch(() => {})
        return NextResponse.json({ error: 'Gagal mengunduh file staging. Coba upload lagi.' }, { status: 502 })
      }
      buffer = Buffer.from(await fetchRes.arrayBuffer())
    } catch (e) {
      console.error('Blob fetch error:', e)
      await db.pdfDocument.update({
        where: { id: doc.id },
        data: { status: 'ERROR', summary: 'Gagal mengambil file.' },
      })
      await del(fromBlobUrl).catch(() => {})
      return NextResponse.json({ error: 'Gagal mengunduh file. Coba lagi.' }, { status: 502 })
    }

    if (buffer.length > BLOB_STAGING_MAX_BYTES) {
      await db.pdfDocument.update({
        where: { id: doc.id },
        data: { status: 'ERROR', summary: 'File melebihi batas ukuran.' },
      })
      await del(fromBlobUrl).catch(() => {})
      return NextResponse.json(
        { error: `File setelah diunduh melebihi ${Math.round(BLOB_STAGING_MAX_BYTES / 1024 / 1024)} MB.` },
        { status: 400 },
      )
    }

    try {
      return await runProcessingWithTimeout(doc, buffer, fileKind, baseTitle)
    } finally {
      await del(fromBlobUrl).catch(() => {})
    }
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Format tidak valid. Kirim sebagai multipart/form-data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })

  const fileKind = detectFileKind(file)
  if (fileKind === null) {
    const n = file.name.toLowerCase()
    if (n.endsWith('.doc') || n.endsWith('.ppt')) {
      return NextResponse.json({
        error: 'Format .doc / .ppt (lama) tidak didukung. Simpan sebagai .docx atau .pptx lalu upload lagi.',
      }, { status: 400 })
    }
    return NextResponse.json({
      error: 'Hanya PDF, Word (.docx), atau PowerPoint (.pptx) yang diterima.',
    }, { status: 400 })
  }

  const maxBytes = maxDocumentUploadBytes()
  if (file.size > maxBytes) {
    const hint = isBlobUploadConfigured()
      ? 'Atau unggah lagi — file besar akan dikirim lewat penyimpanan blob otomatis.'
      : process.env.VERCEL
        ? 'Di production, tambahkan Vercel Blob (BLOB_READ_WRITE_TOKEN) untuk file hingga ~80 MB, atau kompres file.'
        : ''
    return NextResponse.json({
      error:
        process.env.VERCEL && !isBlobUploadConfigured()
          ? `Ukuran file melebihi batas body request (${maxDocumentUploadLabel()}). ${hint}`
          : `Ukuran file maksimal ${maxDocumentUploadLabel()}. ${hint}`.trim(),
    }, { status: 400 })
  }

  const customTitle = (formData.get('title') as string | null)?.trim() || ''
  const baseTitle = customTitle || stripOfficeExt(file.name)

  const [doc] = await db.$transaction([
    db.pdfDocument.create({
      data: {
        userId,
        title: baseTitle,
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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return runProcessingWithTimeout(doc, buffer, fileKind, baseTitle)
}
