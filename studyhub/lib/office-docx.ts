import mammoth from 'mammoth'

export async function extractDocxText(buffer: Buffer): Promise<{ text: string }> {
  const { value } = await mammoth.extractRawText({ buffer })
  const text = (value ?? '').replace(/\r\n/g, '\n').trim()
  return { text }
}
