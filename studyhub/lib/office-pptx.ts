import unzipper from 'unzipper'

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function extractTextRunsFromXml(xml: string): string {
  const chunks: string[] = []
  for (const re of [
    /<a:t[^>]*>([^<]*)<\/a:t>/gi,
    /<w:t[^>]*>([^<]*)<\/w:t>/gi,
    /<dsp:t[^>]*>([^<]*)<\/dsp:t>/gi,
  ]) {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(xml)) !== null) {
      const t = decodeXmlEntities(m[1].trim())
      if (t) chunks.push(t)
    }
  }
  let joined = chunks.join(' ').replace(/\s+/g, ' ').trim()
  if (joined.length < 30) {
    const stripped = decodeXmlEntities(
      xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (stripped.length > joined.length) joined = stripped
  }
  return joined
}

function normZipPath(p: string): string {
  return p.replace(/\\/g, '/')
}

type ZipEntry = { path: string; type: string; buffer: (password?: string) => Promise<Buffer> }

/**
 * Ekstrak teks .pptx pakai unzipper (stabil di Vercel; hindari JSZip).
 */
export async function extractPptxText(buffer: Buffer): Promise<{ text: string; slideCount: number }> {
  const directory = await unzipper.Open.buffer(buffer)
  const files = (directory.files as ZipEntry[]).filter((f) => f.type !== 'Directory')

  const paths = files.map((f) => normZipPath(f.path))

  const slidePaths = paths
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)?.[1] ?? '0', 10)
      const nb = parseInt(b.match(/slide(\d+)/i)?.[1] ?? '0', 10)
      return na - nb
    })

  const notePaths = paths
    .filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/notesSlide(\d+)/i)?.[1] ?? '0', 10)
      const nb = parseInt(b.match(/notesSlide(\d+)/i)?.[1] ?? '0', 10)
      return na - nb
    })

  const parts: string[] = []

  for (let i = 0; i < slidePaths.length; i++) {
    const entry = files.find((f) => normZipPath(f.path) === slidePaths[i])
    if (!entry) continue
    const buf = await entry.buffer()
    const xml = buf.toString('utf8')
    const slideText = extractTextRunsFromXml(xml)
    if (slideText) parts.push(`--- Slide ${i + 1} ---\n${slideText}`)
  }

  for (let i = 0; i < notePaths.length; i++) {
    const entry = files.find((f) => normZipPath(f.path) === notePaths[i])
    if (!entry) continue
    const buf = await entry.buffer()
    const xml = buf.toString('utf8')
    const noteText = extractTextRunsFromXml(xml)
    if (noteText) parts.push(`--- Catatan slide ${i + 1} ---\n${noteText}`)
  }

  const text = parts.join('\n\n').trim()
  const slideCount = slidePaths.length || (notePaths.length ? notePaths.length : 0)
  return { text, slideCount }
}
