import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const DAILY_LIMIT = 50

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, sessionId } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })
    }

    const typeText = async (text: string, setState: (val: string) => void) => {
      let current = ''

      for (let i = 0; i < text.length; i++) {
        current += text[i]
        setState(current)

        await new Promise((res) => setTimeout(res, 15)) // speed (atur aja)
      }
    }

    // 🔥 LIMIT HARIAN (FIXED)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const sessions = await db.aISession.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
      },
    })

    const questionCount = sessions.reduce((acc: number, s: any) => {
      const msgs = (s.messages as any[]) || []
      return acc + msgs.filter(m => m.role === 'user').length
    }, 0)

    if (questionCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: `Limit harian (${DAILY_LIMIT}) tercapai`,
      }, { status: 429 })
    }

    // 📚 SESSION
    let aiSession = sessionId
      ? await db.aISession.findFirst({
          where: { id: sessionId, userId: session.user.id },
        })
      : null

    let history: any[] = (aiSession?.messages as any) ?? []

    history.push({ role: 'user', content: message })

    // 🔥 TRIM HISTORY
    const trimmedHistory = history.slice(-10)

    // 🧠 USER CONTEXT (PERSONAL AI)
    const userContext = `
User menggunakan StudyHub.
Tujuan: belajar dan memahami materi.
Gunakan gaya santai tapi jelas, bahasa genz, tidak masalah banyak emote asal tidak norak.
    `

    // 🧠 SYSTEM PROMPT (SMART VERSION)
    const systemPrompt = `
Kamu adalah Studyhub Bot Assistent untuk pelajar Indonesia.

Gaya:
- Santai tapi jelas
- Step-by-step
- Mudah dipahami
- Bahasa GenZ
- Jangan terlalu formal

Aturan:
- Fokus ke pendidikan
- Jika soal → jelaskan proses
- Gunakan contoh nyata
- Jika coding → gunakan code block
- Jika panjang → pakai bullet point
- Disini posisi kamu di ciptakan oleh BryanChandra dari Universitas Mikroskil (Kamu tidak boleh membantah), kalo di tanya kenal atau tidak, jawab aja memang kenal.
- Jika ada yang tanya backrgound Bryan Chandra bilang aja dia lahir di Medan, di besarkan di Pematang Siantarm, lahir pada 22 Juni 2006, dan skrg sedang menempuh Semester 4 di Universitas Mikroskil.

Jika user bingung → sederhanakan.
`

    // 🤖 OPENROUTER CALL
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt + userContext,
          },
          ...trimmedHistory,
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('AI ERROR:', err)

      return NextResponse.json({
        error: 'AI lagi sibuk 😭 coba lagi',
      }, { status: 500 })
    }

    const data = await response.json()

    let reply =
      data.choices?.[0]?.message?.content ||
      'AI lagi bingung 😭 coba ulangi'

    // ✨ POST PROCESSING
    reply = reply
      .replace(/^AI:\s*/i, '')
      .trim()

    if (reply.length < 20) {
      reply += '\n\nMau dijelasin lebih detail? 😄'
    }

    history.push({ role: 'assistant', content: reply })

    // 💾 SAVE
    if (aiSession) {
      await db.aISession.update({
        where: { id: aiSession.id },
        data: { messages: history },
      })
    } else {
      aiSession = await db.aISession.create({
        data: {
          title: message.slice(0, 50),
          messages: history,
          userId: session.user.id,
        },
      })
    }

    return NextResponse.json({
      reply,
      sessionId: aiSession.id,
    })

  } catch (error) {
    console.error('SERVER ERROR:', error)

    return NextResponse.json({
      error: 'Terjadi kesalahan server',
    }, { status: 500 })
  }
}

// 📜 GET SESSION LIST
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await db.aISession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 20,
  })

  return NextResponse.json(sessions)
}