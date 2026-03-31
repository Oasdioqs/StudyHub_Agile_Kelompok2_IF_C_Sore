import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

type SimpleMessage = { role: 'user' | 'assistant'; content: string }
type AttachmentPayload = { type: 'image' | 'text' | 'file'; name?: string; content?: string; mimeType?: string }

// ─── GET: ambil daftar sesi chat user ────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sessions = await db.aISession.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(sessions)
  } catch {
    return NextResponse.json({ error: 'Riwayat chat belum bisa dimuat.' }, { status: 503 })
  }
}

// ─── POST: kirim pesan ke AI ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  try {
    const body = await req.json()
    const {
      message,
      sessionId,
      mode,
      historyOverride,
      attachments,
      sessionSettings,
      taskFormSubmission,
    } = body

    // Bangun history pesan
    let history: SimpleMessage[] = []

    if (Array.isArray(historyOverride) && historyOverride.length > 0) {
      // Client mengirim history eksplisit (saat edit pesan)
      history = historyOverride.map((m: any) => ({
        role: m.role,
        content: String(m.content || ''),
      }))
    } else if (sessionId) {
      // Ambil history dari DB berdasarkan sessionId
      try {
        const existing = await db.aISession.findFirst({
          where: { id: sessionId, userId },
          select: { messages: true },
        })
        if (existing && Array.isArray(existing.messages)) {
          history = (existing.messages as any[]).map((m: any) => ({
            role: m.role,
            content: String(m.content || ''),
          }))
        }
      } catch { /* biarkan history kosong */ }
    }

    // Susun userMessage dari text + attachments
    let userText = String(message || '').trim()

    if (taskFormSubmission) {
      const t = taskFormSubmission
      userText = `Tambah tugas baru:\nJudul: ${t.title}\nMapel: ${t.subject}\nDeadline: ${t.deadline}${t.status ? `\nStatus: ${t.status}` : ''}${t.priority ? `\nPrioritas: ${t.priority}` : ''}`
    }

    // Proses attachments
    const contentParts: any[] = []
    if (userText) contentParts.push({ type: 'text', text: userText })

    if (Array.isArray(attachments)) {
      for (const att of attachments as AttachmentPayload[]) {
        if (att.type === 'image' && att.content) {
          const imageUrl = att.content.startsWith('data:')
            ? att.content
            : `data:${att.mimeType || 'image/jpeg'};base64,${att.content}`
          contentParts.push({ type: 'image_url', image_url: { url: imageUrl } })
        } else if ((att.type === 'text' || att.type === 'file') && att.content) {
          const extra = `\n\n[Lampiran: ${att.name}]\n${att.content.slice(0, 8000)}`
          if (contentParts.length > 0 && contentParts[0]?.type === 'text') {
            contentParts[0].text += extra
          } else {
            contentParts.unshift({ type: 'text', text: extra })
          }
        }
      }
    }

    if (contentParts.length === 0) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 })
    }

    // Append user message ke history
    const userMsgContent = contentParts.length === 1 && contentParts[0].type === 'text'
      ? contentParts[0].text
      : contentParts
    history.push({ role: 'user', content: userMsgContent as string })

    // Fetch user context
    const [tasks, schedule, stats, profile] = await Promise.all([
      db.task.findMany({ where: { userId, status: { not: 'DONE' } }, select: { id: true, title: true, deadline: true, priority: true } }),
      db.weeklyScheduleSlot.findMany({ where: { userId }, select: { dayOfWeek: true, title: true, startTime: true } }),
      db.dashboardDay.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { totalTasks: true, doneTasks: true, progress: true } }),
      db.user.findUnique({ where: { id: userId }, select: { name: true, points: true, streak: true } })
    ])

    const contextStr = `
=== KONTEKS USER SAAT INI ===
User: ${profile?.name || 'User'} (Points: ${profile?.points}, Streak: ${profile?.streak})
Tugas Belum Selesai: ${tasks.map(t => `- ${t.title} [Prio: ${t.priority}] (DL: ${t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID') : 'None'})`).join('\n') || 'Tidak ada/Kosong'}
Jadwal Per Minggu: ${schedule.map(s => `- Hari ${s.dayOfWeek}: ${s.title} (${s.startTime})`).join('\n') || 'Kosong'}
Progress Hari Ini: Total ${stats?.totalTasks || 0}, Selesai ${stats?.doneTasks || 0} (${stats?.progress || 0}%)
=============================`.trim()

    // Mode prompt adjustment
    const modeInstruction = mode === 'detail'
      ? 'Berikan penjelasan sangat detail dan mendalam.'
      : mode === 'exam'
        ? 'Mode UJIAN: Berikan soal latihan, kisi-kisi, dan tips menghadapi ujian.'
        : 'Jawab dengan ringkas, padat, dan tepat sasaran.'

    // Session settings
    const ss = sessionSettings || {}
    const toneMap: Record<string, string> = {
      genz: 'Gunakan bahasa gaul Gen-Z yang asik tapi tetap informatif.',
      formal: 'Gunakan bahasa formal dan akademis.',
      santai: 'Gunakan bahasa santai sehari-hari.',
      mentor: 'Berperan sebagai mentor yang bijak dan suportif.',
    }
    const detailMap: Record<string, string> = {
      ringkas: 'Jawab sangat ringkas, 2-4 kalimat saja.',
      normal: 'Jawaban normal, secukupnya.',
      detail: 'Jelaskan secara detail dan komprehensif.',
    }

    const sysContent = `Kamu adalah ${ss.botName || 'StudyHub Bot'}, asisten belajar pintar di platform StudyHub.
Nama user: ${ss.userName || profile?.name || 'Kamu'}.

${toneMap[ss.tone] || toneMap['genz']}
${detailMap[ss.detailLevel] || detailMap['normal']}
${ss.emojiLevel === 'minim' ? 'Gunakan emoji sesekali saja.' : 'Gunakan emoji secukupnya untuk membuat percakapan lebih hidup.'}
Bahasa respons: ${ss.language === 'en' ? 'English' : 'Bahasa Indonesia'}.
Format: ${ss.responseFormat === 'bullet' ? 'Utamakan format bullet list.' : ss.responseFormat === 'table' ? 'Utamakan format tabel markdown.' : ss.responseFormat === 'paragraph' ? 'Gunakan paragraf naratif.' : 'Gunakan markdown yang bervariasi (heading, bullet, tabel sesuai konteks).'}

${modeInstruction}

ATURAN UTAMA:
1. Selalu manfaatkan KONTEKS USER. Ingatkan tugas yang mendekati deadline secara ramah.
2. DILARANG berhalusinasi soal data user. Jika tidak ada di konteks, katakan belum dicatat.
3. Jika user minta tambah tugas: panduan format: Judul, Mapel, Deadline (contoh: "31 Maret 2026 23:59").
4. Untuk aksi aplikasi, sertakan link markdown: [📝 Ke Halaman Tugas](/tasks), [📅 Kalender](/calendar), [⏱️ Timer Pomodoro](/timer), [📊 Analitik](/analytics).

${contextStr}`

    const sysPrompt = { role: 'system', content: sysContent }

    // Buat payload untuk OpenRouter
    const aiMessages = [
      sysPrompt,
      ...history.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ].filter((m) => !!m.content)

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://studyhub.vercel.app',
        'X-Title': 'StudyHub AI Tutor',
      },
      body: JSON.stringify({ model: AI_MODEL, messages: aiMessages }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      console.error('OpenRouter Error:', err)
      return NextResponse.json({ error: 'AI Error: ' + err }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const reply: string = aiData.choices?.[0]?.message?.content || 'Maaf, aku sedang tidak bisa memberi jawaban.'

    // Simpan ke DB
    const finalMessages = [
      ...history.slice(0, -1).map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
      { role: 'user', content: typeof userMsgContent === 'string' ? userMsgContent : userText },
      { role: 'assistant', content: reply },
    ]

    let newSessionId = sessionId
    try {
      if (sessionId) {
        const existing = await db.aISession.findFirst({ where: { id: sessionId, userId } })
        if (existing) {
          // Auto-generate title dari pesan pertama jika masih default
          const shouldUpdateTitle = existing.title === 'New Chat' || existing.title === 'Chat Belajar'
          await db.aISession.update({
            where: { id: sessionId },
            data: {
              messages: finalMessages as any,
              ...(shouldUpdateTitle && userText
                ? { title: userText.slice(0, 60) }
                : {}),
            },
          })
        } else {
          // sessionId dikirim tapi tidak ada di DB → buat baru
          await db.aISession.create({
            data: {
              id: sessionId,
              userId,
              title: userText.slice(0, 60) || 'Chat Baru',
              messages: finalMessages as any,
            },
          })
        }
      } else {
        // Sesi baru
        const created = await db.aISession.create({
          data: {
            userId,
            title: userText.slice(0, 60) || 'Chat Baru',
            messages: finalMessages as any,
          },
        })
        newSessionId = created.id
      }
    } catch (dbErr) {
      console.error('DB save error:', dbErr)
      // Tetap kembalikan reply meski gagal simpan
    }

    return NextResponse.json({ reply, sessionId: newSessionId })
  } catch (error: any) {
    console.error('Chat AI Error:', error)
    return NextResponse.json({ error: 'Gagal memproses AI.' }, { status: 500 })
  }
}