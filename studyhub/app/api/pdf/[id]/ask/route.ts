import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, extractedText: true, status: true, title: true },
  })

  if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  if (doc.status !== 'READY') return NextResponse.json({ error: 'Dokumen belum siap.' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const question: string = (body.question ?? '').trim()
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-6) : [] // max 6 pesan terakhir

  if (!question) return NextResponse.json({ error: 'Pertanyaan tidak boleh kosong.' }, { status: 400 })

  const hasText = doc.extractedText && doc.extractedText.trim().length > 50
  const context = hasText ? doc.extractedText.slice(0, 40000) : null

  // Deteksi apakah dokumen image-heavy
  const hasOcrContent = doc.extractedText.includes('=== KONTEN DARI GAMBAR/HALAMAN SCAN ===')
  const isImageHeavy = !hasText || hasOcrContent

  const systemPrompt = `Kamu adalah asisten akademik cerdas bernama StudyHub AI yang membantu mahasiswa memahami dokumen "${doc.title}".

KEMAMPUAN KAMU:
1. Menjawab pertanyaan berdasarkan isi dokumen
2. Menjelaskan konsep dari dokumen menggunakan pengetahuan umummu
3. Menampilkan kode program dalam format code block (${"`"}${"`"}${"`"}python, ${"`"}${"`"}${"`"}java, dll)
4. Menghubungkan materi dokumen dengan konsep yang lebih luas
5. Membantu debugging kode yang ditemukan di dokumen

CARA MENJAWAB:
- PRIORITASKAN informasi dari dokumen di bawah ini
- Untuk konsep yang ada di dokumen tapi perlu penjelasan lebih detail, gunakan pengetahuanmu SAMBIL menyebut "berdasarkan dokumen ini..." atau "untuk melengkapi materi ini..."
- Jika pertanyaan tentang kode, tampilkan dalam code block yang lengkap dan bisa dijalankan
- Tolak HANYA jika pertanyaan 100% tidak berkaitan dengan topik dokumen
- Jika dokumen berisi hasil OCR gambar (kode screenshot dll), analisis dengan cermat
- Gunakan Bahasa Indonesia yang jelas dan ramah${isImageHeavy ? '\n- PENTING: Dokumen ini mengandung konten berbasis gambar/scan — beberapa informasi mungkin berasal dari OCR otomatis' : ''}

${context ? `ISI DOKUMEN:\n${context}` : 'CATATAN: Teks dokumen tidak tersedia (mungkin file PDF berbasis gambar murni). Bantu sebisamu berdasarkan judul dokumen dan pengetahuanmu.'}`

  // Bangun pesan conversation dengan history
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: question },
  ]

  try {
    const answer = await callAI(messages, 1500, 50_000)
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('PDF ask error:', err)
    return NextResponse.json({ error: 'Gagal mendapatkan jawaban. Coba lagi.' }, { status: 500 })
  }
}
