import unzipper from 'unzipper'
import { callAIVision } from '@/lib/openrouter'

/** Disematkan ke extractedText — dipakai prompt ringkasan untuk memicu section visual. */
export const MARKER_VISUAL_EMBEDDED = '=== GAMBAR, DIAGRAM, DAN VISUAL DARI DOKUMEN ==='

/** Marker lama dari OCR halaman PDF scan (tetap didukung). */
export const MARKER_PDF_SCAN = '=== KONTEN DARI GAMBAR/HALAMAN SCAN ==='

export type OfficeRaster = { base64: string; mime: 'image/png' | 'image/jpeg'; label: string }

/** Ekstrak sebanyak mungkin dari zip; analisis vision dibatasi terpisah. */
const OFFICE_RASTER_SCAN_LIMIT = 28
const MAX_OFFICE_IMAGES_ANALYZED = 20
const MAX_SUMMARY_GALLERY_FIGURES = 8
const MAX_OFFICE_IMAGE_BYTES = 1.25 * 1024 * 1024
const VISION_BATCH_SIZE = 4
const COMBINED_VISION_TIMEOUT_MS = 12_000

/** Prompt halaman PDF: OCR verbatim + deskripsi visual untuk ringkasan. */
export const PDF_PAGE_OCR_AND_VISUAL_PROMPT = `Lakukan dua bagian berurutan (gunakan Bahasa Indonesia untuk bagian 2):

[BAGIAN 1 — OCR]
Ekstrak SEMUA teks yang terbaca di gambar secara verbatim. Jika ada kode program, gunakan code block dengan penanda bahasa yang tepat (\`\`\`python, \`\`\`java, dll). Jika tidak ada teks, tulis "(tidak ada teks terbaca)".

[BAGIAN 2 — DESKRIPSI VISUAL]
Mulai dengan baris persis: ### Deskripsi visual
Lalu jelaskan dalam 4–10 kalimat: jenis gambar (diagram alur, arsitektur, screenshot UI, grafik, foto, slide konsep, dll.), apa yang ditampilkan, hubungan antar elemen, dan poin pembelajaran utama. Sebut label atau angka penting yang terlihat. Jika ini murni dekorasi tanpa konten akademik, tulis satu kalimat singkat.`

const OFFICE_COMBINED_PROMPT = `Ini satu gambar dari file Word/PowerPoint akademik.

BARIS PERTAMA wajib persis salah satu (tanpa teks lain di baris itu):
JENIS: MATERI
atau
JENIS: DEKORASI

Arti:
- MATERI = konten pembelajaran: teks slide/poin, diagram, alur, grafik, tabel, skema, screenshot materi/kode, contoh soal, ilustrasi konsep.
- DEKORASI = logo universitas/institusi, watermark, background hias tanpa materi, ornamen, foto pembuka formal tanpa poin materi, ikon hias.

Baris kedua dan seterusnya — Bahasa Indonesia:
- Jika MATERI: 6–14 kalimat (jenis visual, teks penting yang terbaca, konsep, kode/rumus dalam code block jika ada).
- Jika DEKORASI: maksimal 2 kalimat singkat (mis. logo atau hiasan apa).

Jika ragu antara MATERI dan DEKORASI, pilih MATERI.`

type ZipEntry = { path: string; type: string; buffer: (password?: string) => Promise<Buffer> }

function normZipPath(p: string): string {
  return p.replace(/\\/g, '/')
}

function parseJenisResponse(raw: string): { kind: 'MATERI' | 'DEKORASI'; body: string } {
  const t = raw.trim()
  const lines = t.split('\n')
  const first = lines[0]?.trim() ?? ''
  let kind: 'MATERI' | 'DEKORASI' = 'MATERI'
  if (/^JENIS:\s*DEKORASI\b/i.test(first)) kind = 'DEKORASI'
  else if (/^JENIS:\s*MATERI\b/i.test(first)) kind = 'MATERI'
  else if (/^DEKORASI\b/i.test(first) && !/^MATERI\b/i.test(first)) kind = 'DEKORASI'
  const body = lines.slice(1).join('\n').trim() || t
  return { kind, body }
}

/**
 * Ambil gambar raster dari pptx/docx (folder media), urutkan.
 */
export async function extractEmbeddedRasters(
  buffer: Buffer,
  kind: 'pptx' | 'docx',
): Promise<OfficeRaster[]> {
  const directory = await unzipper.Open.buffer(buffer)
  const files = (directory.files as ZipEntry[]).filter((f) => f.type !== 'Directory')
  const prefix = kind === 'pptx' ? 'ppt/media/' : 'word/media/'
  const extRe = /\.(png|jpg|jpeg)$/i
  const out: OfficeRaster[] = []

  for (const f of files) {
    const p = normZipPath(f.path)
    if (!p.toLowerCase().startsWith(prefix)) continue
    if (!extRe.test(p)) continue
    let buf: Buffer
    try {
      buf = await f.buffer()
    } catch {
      continue
    }
    if (buf.length > MAX_OFFICE_IMAGE_BYTES || buf.length < 80) continue
    const lower = p.toLowerCase()
    const mime: 'image/png' | 'image/jpeg' = lower.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const name = p.slice(prefix.length)
    out.push({ base64: buf.toString('base64'), mime, label: name })
  }

  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  return out.slice(0, OFFICE_RASTER_SCAN_LIMIT)
}

/**
 * Analisis semua gambar (hingga batas): satu panggilan vision per gambar (JENIS + deskripsi).
 * Semua deskripsi masuk konteks dokumen; hanya JENIS: MATERI yang disarankan untuk galeri ringkasan.
 */
export async function analyzeOfficeRastersForDoc(
  images: OfficeRaster[],
): Promise<{ appendix: string; galleryRasters: OfficeRaster[]; skippedCount: number }> {
  const toProcess = images.slice(0, MAX_OFFICE_IMAGES_ANALYZED)
  const skippedCount = Math.max(0, images.length - toProcess.length)

  type Row = { order: number; raster: OfficeRaster; kind: 'MATERI' | 'DEKORASI'; body: string }
  const rows: Row[] = []

  for (let start = 0; start < toProcess.length; start += VISION_BATCH_SIZE) {
    const chunk = toProcess.slice(start, start + VISION_BATCH_SIZE)
    const chunkOut = await Promise.all(
      chunk.map(async (raster, k) => {
        const order = start + k
        try {
          const raw = await callAIVision(
            raster.base64,
            raster.mime,
            OFFICE_COMBINED_PROMPT,
            COMBINED_VISION_TIMEOUT_MS,
            2000,
          )
          const { kind, body } = parseJenisResponse(raw)
          return { order, raster, kind, body: body || raw.trim() }
        } catch {
          return {
            order,
            raster,
            kind: 'DEKORASI' as const,
            body: '(Gagal menganalisis gambar; diperlakukan sebagai non-materi untuk galeri.)',
          }
        }
      }),
    )
    rows.push(...chunkOut)
  }

  rows.sort((a, b) => a.order - b.order)

  const parts = rows.map(
    (r) =>
      `[Gambar ${r.order + 1}: ${r.raster.label} — ${r.kind === 'MATERI' ? 'materi' : 'dekorasi'}]\n${r.body}`,
  )
  let appendix = parts.length ? `${MARKER_VISUAL_EMBEDDED}\n${parts.join('\n\n')}` : ''
  if (skippedCount > 0) {
    appendix +=
      (appendix ? '\n\n' : '') +
      `[Catatan] ${skippedCount} gambar tambahan di dokumen tidak dianalisis otomatis (batas ${MAX_OFFICE_IMAGES_ANALYZED} gambar per unggahan).`
  }

  const galleryRasters: OfficeRaster[] = []
  for (const r of rows) {
    if (r.kind === 'MATERI' && galleryRasters.length < MAX_SUMMARY_GALLERY_FIGURES) {
      galleryRasters.push(r.raster)
    }
  }

  return { appendix, galleryRasters, skippedCount }
}

/** Tanpa galeri — hanya teks tambahan (untuk pemanggil yang tidak upload). */
export async function describeEmbeddedOfficeImages(
  buffer: Buffer,
  kind: 'pptx' | 'docx',
): Promise<string> {
  const images = await extractEmbeddedRasters(buffer, kind)
  const { appendix } = await analyzeOfficeRastersForDoc(images)
  return appendix
}
