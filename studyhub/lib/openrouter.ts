const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
// Vision model — must support image input
const VISION_MODEL = 'openai/gpt-4o-mini'

export async function callAI(
  messages: { role: string; content: string }[],
  maxTokens = 2000,
  timeoutMs = 30_000,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app',
        'X-Title': 'StudyHub PDF AI',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString())
      throw new Error(`AI call failed: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Kirim gambar (base64 PNG/JPEG) ke vision AI untuk OCR / ekstraksi teks.
 * Cocok untuk halaman PDF yang berisi screenshot kode atau gambar scan.
 */
export async function callAIVision(
  base64Image: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
  prompt: string,
  timeoutMs = 25_000,
  maxTokens = 2000,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app',
        'X-Title': 'StudyHub PDF Vision',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString())
      throw new Error(`Vision AI call failed: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  } finally {
    clearTimeout(timer)
  }
}
