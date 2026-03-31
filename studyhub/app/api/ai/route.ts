import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

type SimpleMessage = { role: 'user' | 'assistant'; content: string }
type AttachmentPayload = { type: 'image' | 'text' | 'file'; name?: string; content?: string }

async function extractTextFromPdfDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:application\/pdf;base64,(.+)$/i)
  if (!match?.[1]) return ''
  const buffer = Buffer.from(match[1], 'base64')
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText()
    await parser.destroy()
    const text = String(textResult?.text || '').trim()
    if (text) return text.slice(0, 8000)
  } catch {}
  return ''
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  try {
    const body = await req.json()
    const { messages, sessionId, isNewChat, settings, attachments } = body
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Process attachments to text
    let userPromptText = messages[messages.length - 1].content || ''
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.type === 'file' && att.content?.startsWith('data:application/pdf')) {
          const pdfStr = await extractTextFromPdfDataUrl(att.content)
          if (pdfStr) userPromptText += `\n\n[Isi Dokumen PDF: ${att.name}]\n${pdfStr}`
        } else if (att.type === 'text' && att.content) {
          const text = Buffer.from(att.content.split(',')[1] || '', 'base64').toString('utf-8')
          userPromptText += `\n\n[Isi Dokumen Text: ${att.name}]\n${text.slice(0, 5000)}`
        }
      }
      messages[messages.length - 1].content = userPromptText
    }

    // Fetch user context for Intent-First AI
    const [tasks, schedule, stats, profile] = await Promise.all([
      db.task.findMany({ where: { userId, status: { not: 'DONE' } }, select: { id: true, title: true, deadline: true, priority: true } }),
      db.weeklyScheduleSlot.findMany({ where: { userId }, select: { dayOfWeek: true, title: true, startTime: true } }),
      db.dashboardDay.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { totalTasks: true, doneTasks: true, progress: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true, points: true, streak: true } })
    ])

    const contextStr = `
=== KONTEKS USER SAAT INI ===
User: ${profile?.name || 'User'} (Points: ${profile?.points}, Streak: ${profile?.streak})
Tugas Belum Selesai: ${tasks.map(t => `- ${t.title} [Prio: ${t.priority}] (DL: ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'None'})`).join('\n') || 'Tidak ada/Kosong'}
Jadwal Per Minggu: ${schedule.map(s => `- Hari ${s.dayOfWeek}: ${s.title} (${s.startTime})`).join('\n') || 'Kosong'}
Progress Hari Ini: Total ${stats?.totalTasks || 0}, Selesai ${stats?.doneTasks || 0} (${stats?.progress || 0}%)
=============================
`.trim()

    const sysPrompt = {
      role: 'system',
      content: `Kamu adalah StudyHub AI, asisten belajar pintar.
      
Kamu menggunakan arsitektur Intent-First. Kamu tidak memanipulasi database secara langsung. Sebagai gantinya, kamu akan memandu pengguna dengan "Action Links" (link aksi) di dalam format Markdown.

Jika pengguna meminta sesuatu yang terkait aksi aplikatif, berikan tombol aksi Markdown ini di akhir responsmu:
- Tambah Tugas Baru: [📝 Tambah Tugas](/tasks?action=new) atau jika ada judul [📝 Tambah Tugas "Belajar"](/tasks?action=new&title=Belajar)
- Tambah Jadwal: [📅 Tambah Jadwal Kuliah](/calendar)
- Mulai Sesi Belajar: [⏱️ Buka Pomodoro Timer](/timer)
- Lihat Analitik: [📊 Buka AI Analitik](/analytics)

ATURAN UTAMA:
1. Bahasamu santai, ramah, layaknya teman kuliah namun tetap profesional. (Atau ikuti setting user jika diminta).
2. Jawaban harus rapi, list menggunakan bullet, jika ada tabel gunakan tabel markdown.
3. Selalu manfaatkan KONTEKS USER yang diberikan. Jika ada tugas belum selesai yang dekat dengan topik, ingatkan user secara ramah.
4. DILARANG BERHALUSINASI soal database. Gunakan KONTEKS USER. Jika data tidak ada di konteks, bilang saja belum dicatat oleh user.
5. Jika user meminta merangkum dokumen/PDF terlampir, rangkum sekilas dan berikan konsep utamanya (dokumen tergabung dalam userPrompt).

${contextStr}
`
    }

    const payload = {
      model: AI_MODEL,
      messages: [sysPrompt, ...messages.map((m: any) => ({ role: m.role, content: m.content }))].filter(m => !!m.content),
    }

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(payload)
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      console.error('OpenRouter Error:', err)
      return NextResponse.json({ error: 'AI Error: ' + err }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const aiMessageContent = aiData.choices?.[0]?.message?.content || 'Maaf, aku sedang tidak bisa memberi jawaban.'

    let newSessionId = sessionId
    if (isNewChat || !sessionId) {
      newSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    }

    // Save strictly to DB
    const finalMessages = [...messages, { role: 'assistant', content: aiMessageContent }]
    const dbSession = await db.aISession.findUnique({ where: { id: newSessionId } })
    if (dbSession) {
      await db.aISession.update({
        where: { id: newSessionId },
        data: { messages: JSON.stringify(finalMessages) }
      })
    } else {
      await db.aISession.create({
        data: {
          id: newSessionId,
          userId,
          title: 'Chat Belajar',
          messages: JSON.stringify(finalMessages)
        }
      })
    }

    return NextResponse.json({
      role: 'assistant',
      content: aiMessageContent,
      sessionId: newSessionId
    })

  } catch (error: any) {
    console.error('Chat AI Error:', error)
    return NextResponse.json({ error: 'Gagal memproses AI.' }, { status: 500 })
  }
}