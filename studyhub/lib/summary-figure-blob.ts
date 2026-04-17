import { put } from '@vercel/blob'
import { isBlobUploadConfigured } from '@/lib/document-kind'

export type SummaryFigure = { url: string; caption: string }

export async function uploadSummaryFigurePng(
  docId: string,
  order: number,
  pngBuffer: Buffer,
): Promise<string | null> {
  if (!isBlobUploadConfigured() || pngBuffer.length < 100) return null
  try {
    const pathname = `studyhub/doc-figures/${docId}/p${String(order).padStart(3, '0')}.png`
    const blob = await put(pathname, pngBuffer, { access: 'public', addRandomSuffix: true })
    return blob.url
  } catch (e) {
    console.error('uploadSummaryFigurePng:', e)
    return null
  }
}

export async function uploadSummaryFigureJpeg(
  docId: string,
  order: number,
  jpegBuffer: Buffer,
): Promise<string | null> {
  if (!isBlobUploadConfigured() || jpegBuffer.length < 100) return null
  try {
    const pathname = `studyhub/doc-figures/${docId}/p${String(order).padStart(3, '0')}.jpg`
    const blob = await put(pathname, jpegBuffer, { access: 'public', addRandomSuffix: true })
    return blob.url
  } catch (e) {
    console.error('uploadSummaryFigureJpeg:', e)
    return null
  }
}

export async function uploadSummaryFigureFromBuffer(
  docId: string,
  order: number,
  buf: Buffer,
  mime: 'image/png' | 'image/jpeg',
): Promise<string | null> {
  return mime === 'image/png'
    ? uploadSummaryFigurePng(docId, order, buf)
    : uploadSummaryFigureJpeg(docId, order, buf)
}
