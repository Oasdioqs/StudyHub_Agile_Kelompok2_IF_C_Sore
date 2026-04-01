import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── POST: generate challenge questions dari PDF ────────────────────────────────
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await db.pdfDocument.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, extractedText: true, status: true, title: true },
  })

  if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  if (doc.status !== 'READY') return NextResponse.json({ error: 'Dokumen belum siap diproses.' }, { status: 400 })
  if (!doc.extractedText) return NextResponse.json({ error: 'Teks PDF kosong.' }, { status: 400 })

  const textSnippet = doc.extractedText.slice(0, 40000)

  const prompt = `Kamu adalah guru akademik ahli. Berdasarkan dokumen berjudul "${doc.title}", buat 8 soal tantangan dalam Bahasa Indonesia.

Aturan:
- Campuran tingkat kesulitan: 3 mudah, 3 sedang, 2 sulit
- Pertanyaan harus spesifik berdasarkan isi dokumen
- Jawaban harus jelas dan lengkap (1-3 kalimat)
- Fokus pada pemahaman konsep, bukan hafalan angka

Kembalikan HANYA array JSON valid seperti ini (tanpa komentar atau teks lain):
[
  {"question":"...", "answer":"...", "difficulty":"easy"},
  {"question":"...", "answer":"...", "difficulty":"medium"},
  {"question":"...", "answer":"...", "difficulty":"hard"}
]

Isi dokumen:
${textSnippet}`

  let challenges: { question: string; answer: string; difficulty: string }[] = []

  try {
    const raw = await callAI([
      { role: 'system', content: 'Kamu adalah guru akademik yang membuat soal dari dokumen belajar.' },
      { role: 'user', content: prompt },
    ], 2000)

    // Parse JSON dari response AI
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in AI response')
    challenges = JSON.parse(jsonMatch[0])
    if (!Array.isArray(challenges)) throw new Error('Not an array')
  } catch (err) {
    console.error('Challenge generation error:', err)
    return NextResponse.json({ error: 'Gagal membuat soal. Coba lagi.' }, { status: 500 })
  }

  // Hapus soal lama, simpan yang baru
  await db.pdfChallenge.deleteMany({ where: { documentId: params.id } })
  await db.pdfChallenge.createMany({
    data: challenges.map((c, i) => ({
      documentId: params.id,
      question: c.question,
      answer: c.answer,
      difficulty: ['easy', 'medium', 'hard'].includes(c.difficulty) ? c.difficulty : 'medium',
      sortOrder: i,
    })),
  })

  const saved = await db.pdfChallenge.findMany({
    where: { documentId: params.id },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ challenges: saved })
}
