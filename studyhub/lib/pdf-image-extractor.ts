/**
 * PDF Image Extractor
 * Renders sparse PDF pages (likely scanned images / screenshots of code)
 * to PNG using pdfjs-dist + @napi-rs/canvas, then returns base64 images
 * for visual OCR via AI vision model.
 */

interface PageImageResult {
  pageNum: number
  base64: string
  width: number
  height: number
}

/**
 * Detects which pages are "image-heavy" (sparse extracted text) and returns their indices.
 * @param fullText Full extracted text from PDF
 * @param pageCount Total number of pages
 */
export function detectSparsePages(fullText: string, pageCount: number): boolean {
  if (pageCount === 0) return false
  const avgCharsPerPage = fullText.length / pageCount
  // If average < 80 chars per page, likely image/scanned PDF
  return avgCharsPerPage < 80
}

/**
 * Renders specified PDF pages as PNG images.
 * Returns base64-encoded PNG for each page.
 * Renders max 6 pages to avoid timeout.
 */
export async function renderPdfPagesAsImages(
  buffer: Buffer,
  maxPages = 6,
): Promise<PageImageResult[]> {
  try {
    const { createCanvas } = await import('@napi-rs/canvas')
    const { getDocumentProxy } = await import('unpdf')

    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const totalPages = pdf.numPages
    const pagesToRender = Math.min(totalPages, maxPages)
    const results: PageImageResult[] = []

    for (let i = 1; i <= pagesToRender; i++) {
      try {
        const page = await pdf.getPage(i)
        // Scale 1.5x for good OCR quality without being too large
        const viewport = page.getViewport({ scale: 1.5 })
        const width = Math.round(viewport.width)
        const height = Math.round(viewport.height)

        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d')

        // Fill white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise

        const buffer = canvas.toBuffer('image/png')
        results.push({
          pageNum: i,
          base64: buffer.toString('base64'),
          width,
          height,
        })
      } catch {
        // Skip pages that fail to render
      }
    }

    return results
  } catch {
    // @napi-rs/canvas not available or other error — return empty
    return []
  }
}
