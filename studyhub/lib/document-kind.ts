export type DocumentKind = 'pdf' | 'docx' | 'pptx'

/** Jenis dokumen dari nama file (tanpa kolom DB — aman walau migrasi tidak sinkron). */
export function inferDocumentKind(fileName: string): DocumentKind {
  const n = fileName.toLowerCase()
  if (n.endsWith('.docx')) return 'docx'
  if (n.endsWith('.pptx')) return 'pptx'
  return 'pdf'
}

/** Vercel membatasi body function ~4.5 MB; di lokal boleh lebih besar. */
export function maxDocumentUploadBytes(): number {
  return process.env.VERCEL ? 4 * 1024 * 1024 : 10 * 1024 * 1024
}

export function maxDocumentUploadLabel(): string {
  return process.env.VERCEL ? '4 MB' : '10 MB'
}

/**
 * Batas upload di browser (bundle client).
 * Production = 4 MB (aman di bawah batas ~4.5 MB Vercel untuk request body).
 * Development = 10 MB untuk uji lokal.
 */
export function maxClientDocumentUploadBytes(): number {
  return process.env.NODE_ENV === 'development' ? 10 * 1024 * 1024 : 4 * 1024 * 1024
}

export function maxClientDocumentUploadLabel(): string {
  return process.env.NODE_ENV === 'development' ? '10 MB' : '4 MB'
}

/** Upload langsung browser → Vercel Blob (lewati batas body route ~4,5 MB). */
export const BLOB_STAGING_MAX_BYTES = 80 * 1024 * 1024

export function isBlobUploadConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

export function blobStagingMaxLabel(): string {
  return '80 MB'
}
