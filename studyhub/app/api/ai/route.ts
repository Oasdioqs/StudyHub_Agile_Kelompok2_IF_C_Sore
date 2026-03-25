// app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const DAILY_LIMIT = 50

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, sessionId } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })

  // Check daily usage via AI sessions created today
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todaySessionCount = await db.aISession.count({
    where: { userId: session.user.id, createdAt: { gte: todayStart } },
  })
  if (todaySessionCount >= DAILY_LIMIT) {
    return NextResponse.json({
      error: `Batas harian tercapai (${DAILY_LIMIT} pertanyaan/hari). Coba lagi besok.`,
    }, { status: 429 })
  }

  // Get or create session with history
  let aiSession = sessionId
    ? await db.aISession.findFirst({ where: { id: sessionId, userId: session.user.id } })
    : null

  const history: { role: string; content: string }[] = (aiSession?.messages as any) ?? []
  history.push({ role: 'user', content: message })

  // Call Anthropic API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Kamu adalah AI Tutor untuk platform StudyHub — platform belajar untuk pelajar dan mahasiswa Indonesia.
Bantu pengguna memahami materi pelajaran, jawab pertanyaan akademik, dan berikan penjelasan yang mudah dipahami.
Gunakan Bahasa Indonesia yang jelas dan ramah. Jika ada rumus atau kode, format dengan baik.
Jangan menjawab pertanyaan di luar konteks akademik dan pendidikan.`,
      messages: history.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    return NextResponse.json({ error: 'AI tidak tersedia saat ini' }, { status: 500 })
  }

  const data = await response.json()
  const reply = data.content[0]?.text ?? 'Maaf, tidak ada jawaban.'

  history.push({ role: 'assistant', content: reply })

  // Save updated session
  if (aiSession) {
    await db.aISession.update({ where: { id: aiSession.id }, data: { messages: history } })
  } else {
    aiSession = await db.aISession.create({
      data: {
        title: message.slice(0, 50),
        messages: history,
        userId: session.user.id,
      },
    })
  }

  return NextResponse.json({ reply, sessionId: aiSession.id })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await db.aISession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    take: 20,
  })

  return NextResponse.json(sessions)
}
