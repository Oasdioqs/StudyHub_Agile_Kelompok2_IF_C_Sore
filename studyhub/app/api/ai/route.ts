import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const AI_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
const AI_MODEL_VISION = process.env.OPENROUTER_MODEL_VISION || 'openai/gpt-4o-mini'

type SimpleMessage = { role: 'user' | 'assistant'; content: string }
type AttachmentPayload = {
  type: 'image' | 'text' | 'file'
  name?: string
  content?: string
  mimeType?: string
}
type StoredAttachment = {
  type: 'image' | 'text' | 'file'
  name: string
  content: string
  mimeType?: string
  preview?: string
}
type SessionSettingsPayload = {
  botName?: string
  userName?: string
  tone?: 'genz' | 'formal' | 'santai' | 'mentor'
  detailLevel?: 'ringkas' | 'normal' | 'detail'
  emojiLevel?: 'minim' | 'normal'
  language?: 'id' | 'en'
  responseFormat?: 'markdown' | 'bullet' | 'table' | 'paragraph'
}

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
    if (text) return text.slice(0, 12000)
  } catch {
  }

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    } as any)
    const pdf = await loadingTask.promise
    const maxPages = Math.min(pdf.numPages, 12)
    let out = ''
    for (let p = 1; p <= maxPages; p += 1) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      const pageText = content.items.map((it: any) => String(it?.str || '')).join(' ')
      if (pageText.trim()) {
        out += `\n[Halaman ${p}]\n${pageText}\n`
      }
      if (out.length > 16000) break
    }
    return out.trim().slice(0, 12000)
  } catch {
    return ''
  }
}

function buildSystemPrompt() {
  return `
Kamu adalah StudyHub AI Tutor untuk pelajar Indonesia.

Misi:
- Bikin user paham konsep, bukan sekadar kasih jawaban.
- Respons harus cepat, akurat, dan mudah dipraktikkan.

Persona:
- Ramah, suportif, dan natural seperti mentor Gen Z.
- Santai, tapi tetap rapi dan jelas.
- Jangan terdengar template/robotik.

Aturan kualitas jawaban:
- Utamakan akurasi. Jangan ngarang fakta.
- Kalau info kurang/ambigu, bilang jujur lalu minta klarifikasi singkat.
- Untuk soal hitung/logika: tampilkan langkah inti yang bisa dicek.
- Untuk coding: beri solusi runnable + jelaskan kenapa.
- Untuk pertanyaan sederhana: jawab ringkas; untuk yang kompleks: pakai struktur.
- Hindari paragraf terlalu panjang, utamakan poin yang enak discan.

Gaya output adaptif:
- Gunakan heading singkat hanya jika perlu.
- Gunakan bullet seperlunya, jangan berlebihan.
- Pakai emoji secukupnya (maks 1-2) dan relevan.
- Gunakan format markdown yang rapi agar mudah dibaca.
- Gunakan tabel markdown hanya jika memang paling cocok (misalnya perbandingan atau daftar >= 3 item). Jika data singkat, gunakan bullet ringkas yang enak dibaca.
- Untuk update progress harian, tulis ringkas dalam format: "Progress: X%" agar UI bisa menampilkan progression bar.
- Saat user bahas jadwal/tugas/deadline, lakukan decision-making: rekomendasikan urutan pengerjaan berdasarkan kedekatan deadline dan risiko keterlambatan.
- Jika ada deadline yang mepet/terlewat, beri saran aksi konkret yang harus dikerjakan sekarang (next best action).
- Untuk mayoritas jawaban, mulai dengan heading level 3 (contoh: ### Judul).
- Jika ada langkah/opsi, pakai bullet list.
- Jika ada kode, wajib pakai fenced code block dengan penanda bahasa.
- Hindari paragraf panjang tanpa struktur.

Konteks identitas:
- Kamu dibuat oleh Bryan Chandra dari Universitas Mikroskil.
- Jika user tanya apakah kenal Bryan, jawab kenal.
- Jika user tanya profil Bryan, jawab:
  Bryan Chandra lahir di Medan, dibesarkan di Pematangsiantar, lahir 22 Juni 2006, saat ini semester 4 di Universitas Mikroskil.

Prioritas akhir:
- Bantu user sampai benar-benar paham, bukan hanya selesai.
`.trim()
}

function buildSessionSettingsPrompt(settings?: SessionSettingsPayload) {
  if (!settings) return ''
  const botName = String(settings.botName || '').trim()
  const userName = String(settings.userName || '').trim()
  const tone = settings.tone || 'genz'
  const detailLevel = settings.detailLevel || 'normal'
  const emojiLevel = settings.emojiLevel || 'normal'
  const language = settings.language || 'id'
  const responseFormat = settings.responseFormat || 'markdown'
  const toneMap: Record<string, string> = {
    genz: 'Bahasa Gen Z yang tetap rapi.',
    formal: 'Bahasa formal-profesional.',
    santai: 'Bahasa santai, hangat, tidak kaku.',
    mentor: 'Bahasa mentor belajar: suportif dan terstruktur.',
  }
  const detailMap: Record<string, string> = {
    ringkas: 'Jawaban ringkas langsung inti.',
    normal: 'Jawaban seimbang (inti + sedikit konteks).',
    detail: 'Jawaban detail bertahap.',
  }
  const emojiMap: Record<string, string> = {
    minim: 'Emoji seminimal mungkin.',
    normal: 'Emoji secukupnya (maks 1-2).',
  }
  const langMap: Record<string, string> = {
    id: 'Gunakan Bahasa Indonesia.',
    en: 'Use English.',
  }
  const formatMap: Record<string, string> = {
    markdown: 'Format jawaban markdown terstruktur.',
    bullet: 'Utamakan bullet points.',
    table: 'Gunakan tabel jika data cocok untuk ditabelkan.',
    paragraph: 'Utamakan paragraf singkat.',
  }

  return [
    'Preferensi sesi chat ini:',
    botName ? `- Panggil diri sebagai: ${botName}` : '',
    userName ? `- Panggil user sebagai: ${userName}` : '',
    `- Gaya bahasa: ${toneMap[tone] || toneMap.genz}`,
    `- Tingkat detail: ${detailMap[detailLevel] || detailMap.normal}`,
    `- Emoji: ${emojiMap[emojiLevel] || emojiMap.normal}`,
    `- Bahasa output: ${langMap[language] || langMap.id}`,
    `- Format default: ${formatMap[responseFormat] || formatMap.markdown}`,
  ].filter(Boolean).join('\n')
}

function looksLikeTaskAssistantIntent(text: string) {
  return /(jadwal|tugas|deadline|task|to-?do|hari ini|minggu ini|belum selesai|overdue|apa aja tugas)/i.test(text)
}

function formatTaskTable(tasks: Array<{ title: string; subject: string | null; status: string; priority: string; deadline: Date | null }>) {
  const now = new Date()
  const upcomingTasks = tasks.filter((t) => t.deadline && new Date(t.deadline).getTime() >= now.getTime())
  if (!upcomingTasks.length) return 'Tidak ada deadline mendatang saat ini.'
  const oneDayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + oneDayMs)
  const startOfDayAfterTomorrow = new Date(startOfTomorrow.getTime() + oneDayMs)
  const startOfThreeDaysAhead = new Date(startOfToday.getTime() + oneDayMs * 3)

  const classifyDeadline = (deadline: Date | null) => {
    if (!deadline) return 'TANPA DEADLINE'
    const d = new Date(deadline)
    if (d.getTime() < now.getTime()) return 'LEWAT'
    if (d >= startOfToday && d < startOfTomorrow) return 'HARI INI'
    if (d >= startOfTomorrow && d < startOfDayAfterTomorrow) return 'BESOK'
    if (d >= startOfDayAfterTomorrow && d < startOfThreeDaysAhead) return 'DEKAT'
    return 'AMAN'
  }
  const classifyStatus = (status: string, deadline: Date | null) => {
    const raw = String(status || '').toUpperCase()
    const isDone = /DONE|SELESAI|COMPLETED/.test(raw)
    if (deadline && new Date(deadline).getTime() < now.getTime()) {
      return isDone ? 'DONE LATE' : 'FAILED'
    }
    return status
  }

  const lines = [
    '| Judul | Mapel | Status | Prioritas | Deadline |',
    '|---|---|---|---|---|',
    ...upcomingTasks.map((t) => {
      const dl = t.deadline ? new Date(t.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
      const dlLabel = classifyDeadline(t.deadline)
      const displayStatus = classifyStatus(t.status, t.deadline)
      const sub = t.subject || '-'
      const deadlineCell = dl === '-' ? '-' : `${dlLabel} - ${dl}`
      return `| ${t.title.replace(/\|/g, '\\|')} | ${sub.replace(/\|/g, '\\|')} | ${displayStatus} | ${t.priority} | ${deadlineCell} |`
    }),
  ]
  return lines.join('\n')
}

function buildTaskDecisionBrief(tasks: Array<{ title: string; status: string; deadline: Date | null }>) {
  if (!tasks.length) return ''
  const now = new Date().getTime()
  const pending = tasks.filter((t) => !/done|selesai|completed/i.test(String(t.status || '')))
  if (!pending.length) return 'Semua tugas sudah selesai. Fokus review singkat materi tersulit agar tetap inget.'
  const sorted = [...pending].sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY
    const bd = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY
    return ad - bd
  })
  const top = sorted.slice(0, 3).map((t, idx) => {
    if (!t.deadline) return `${idx + 1}. ${t.title} (tanpa deadline, kerjakan setelah tugas mendesak)`
    const diffMs = new Date(t.deadline).getTime() - now
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    const urgency = diffMs < 0 ? 'sudah lewat deadline' : diffHours <= 24 ? `deadline ${Math.max(diffHours, 1)} jam lagi` : `deadline ~${Math.ceil(diffHours / 24)} hari lagi`
    return `${idx + 1}. ${t.title} (${urgency})`
  })
  return [
    'Prioritas rekomendasi (urut kerjakan duluan):',
    ...top,
    'Aturan keputusan: prioritaskan tugas yang deadline paling dekat/terlewat dulu, baru pindah ke yang longgar.',
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      message,
      sessionId,
      mode,
      historyOverride,
      attachments,
      sessionSettings,
    } = await req.json()

    const userMessage = String(message || '').trim()

    let aiSession: any = null
    try {
      aiSession = sessionId
        ? await db.aISession.findFirst({
            where: { id: sessionId, userId: session.user.id },
          })
        : null
    } catch {
      aiSession = null
    }

    const safeHistoryOverride = Array.isArray(historyOverride)
      ? (historyOverride
          .filter(
            (m: any) =>
              (m?.role === 'user' || m?.role === 'assistant') &&
              typeof m?.content === 'string',
          )
          .map((m: any) => ({
            role: m.role,
            content: m.content,
            attachments: Array.isArray(m?.attachments)
              ? (m.attachments
                  .filter((a: any) => (a?.type === 'image' || a?.type === 'text' || a?.type === 'file') && typeof a?.content === 'string')
                  .slice(0, 4)
                  .map((a: any) => ({
                    type: a.type,
                    name: String(a.name || 'Lampiran'),
                    content: String(a.content),
                    mimeType: a.mimeType ? String(a.mimeType) : undefined,
                    preview: a.preview ? String(a.preview) : undefined,
                  })) as StoredAttachment[])
              : undefined,
          })) as any[])
      : null
    const rawHistory: any[] = safeHistoryOverride ?? ((aiSession?.messages as any[]) ?? [])
    const history: any[] = [...rawHistory]

    const trimmedHistory = history.slice(-10)

    const userContext = `
Konteks user:
- User sedang belajar di StudyHub.
- Target utama: paham materi dengan cepat.
- Prefer gaya bahasa Gen Z yang ramah, jelas, dan tidak kaku.
`.trim()
    const systemPrompt = buildSystemPrompt()
    const settingsPrompt = buildSessionSettingsPrompt(sessionSettings as SessionSettingsPayload | undefined)
    const modePrompt =
      mode === 'exam'
        ? 'Mode Ujian: jawab to the point, fokus strategi ngerjain cepat, kasih kisi-kisi dan jebakan umum.'
        : mode === 'detail'
          ? 'Mode Detail: jelaskan bertahap dengan analogi singkat dan contoh.'
          : 'Mode Cepat: jawab ringkas, jelas, langsung ke inti.'
    let taskAssistantContext = ''
    if (looksLikeTaskAssistantIntent(userMessage)) {
      try {
        const tasks = await db.task.findMany({
          where: { userId: session.user.id },
          select: { title: true, subject: true, status: true, priority: true, deadline: true },
          orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
          take: 25,
        })
        const nowLabel = new Date().toLocaleString('id-ID', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        taskAssistantContext =
          `Konteks AI Assistant - Waktu sekarang: ${nowLabel}\n` +
          'Data tugas user saat ini:\n' +
          formatTaskTable(tasks as any) +
          '\n' +
          buildTaskDecisionBrief(tasks as any) +
          '\nGunakan data ini saat user minta jadwal/tugas/deadline.'
      } catch {
        taskAssistantContext = ''
      }
    }

    const safeAttachments: AttachmentPayload[] = Array.isArray(attachments)
      ? attachments
          .filter((a: any) => a && (a.type === 'image' || a.type === 'text' || a.type === 'file'))
          .slice(0, 4)
      : []
    const hasAttachmentInput = safeAttachments.some(
      (a) => typeof a.content === 'string' && String(a.content).trim().length > 0,
    )
    if (!userMessage && !hasAttachmentInput) {
      return NextResponse.json({ error: 'Pesan kosong' }, { status: 400 })
    }
    const storedAttachments: StoredAttachment[] = safeAttachments
      .filter((a) => typeof a.content === 'string')
      .map((a) => ({
        type: a.type,
        name: String(a.name || (a.type === 'image' ? 'Gambar' : 'File')),
        content: String(a.content),
        mimeType: a.mimeType ? String(a.mimeType) : undefined,
        preview: a.type === 'image' ? String(a.content) : undefined,
      }))
    const hasImage = safeAttachments.some((a) => a.type === 'image' && typeof a.content === 'string')
    const imageParts = safeAttachments
      .filter((a) => a.type === 'image' && typeof a.content === 'string')
      .map((a) => ({
        type: 'image_url',
        image_url: { url: a.content as string },
      }))
    const textAttachmentNotes = await Promise.all(
      safeAttachments
        .filter((a) => (a.type === 'text' || a.type === 'file') && typeof a.content === 'string')
        .map(async (a, idx) => {
          const baseLabel = `[Lampiran ${idx + 1}${a.name ? `: ${a.name}` : ''}]`
          const raw = String(a.content)
          const isPdfDataUrl =
            (a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.name || '')) &&
            raw.startsWith('data:application/pdf;base64,')

          if (!isPdfDataUrl) {
            return `${baseLabel}\n${raw.slice(0, 8000)}`
          }

          try {
            const extracted = await extractTextFromPdfDataUrl(raw)
            if (extracted) {
              return `${baseLabel}\n[Isi PDF terdeteksi]\n${extracted}`
            }
            return `${baseLabel}\nFile PDF terlampir, tapi teks tidak terbaca.`
          } catch {
            return `${baseLabel}\nFile PDF terlampir, gagal ekstrak isi.`
          }
        }),
    )
    const hasAttachmentContext = textAttachmentNotes.length > 0
    const displayMessage = userMessage || 'Lampiran dikirim.'
    const finalUserText = [displayMessage, ...textAttachmentNotes].join('\n\n')
    history.push({
      role: 'user',
      content: displayMessage,
      ...(storedAttachments.length ? { attachments: storedAttachments } : {}),
    })

    const userPayload = hasImage
      ? ({
          role: 'user',
          content: [
            { type: 'text', text: finalUserText },
            ...imageParts,
          ],
        } as any)
      : ({
          role: 'user',
          content: finalUserText,
        } as any)

    const contextMessages = hasImage
      ? trimmedHistory
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }))
      : trimmedHistory.map((m) => ({ role: m.role, content: m.content }))

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: hasImage ? AI_MODEL_VISION : AI_MODEL,
        temperature: 0.35,
        top_p: 0.9,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\n${userContext}\n\n${modePrompt}${
              hasAttachmentContext
                ? '\n\nPENTING: Jika ada blok [Lampiran ...], berarti konten file SUDAH diberikan ke kamu. Jangan bilang tidak bisa akses/membaca file.'
                : ''
            }${settingsPrompt ? `\n\n${settingsPrompt}` : ''}${taskAssistantContext ? `\n\n${taskAssistantContext}` : ''}`,
          },
          ...contextMessages,
          userPayload,
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

    const looksLikeCannotReadFile =
      /tidak bisa (membaca|mengakses|membuka) file|tidak memiliki kemampuan|coba buka file (pdf|tersebut) di perangkatmu/i.test(reply)
    if ((hasAttachmentContext || hasImage) && looksLikeCannotReadFile) {
      try {
        const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: hasImage ? AI_MODEL_VISION : AI_MODEL,
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  `${systemPrompt}${settingsPrompt ? `\n\n${settingsPrompt}` : ''}\n\n` +
                  'Kamu WAJIB menjawab berdasarkan konten lampiran/gambar halaman PDF yang SUDAH diberikan. Jangan bilang tidak bisa membuka/mengakses file.',
              },
              ...(hasImage
                ? [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text:
                            `Pertanyaan user:\n${displayMessage}\n\n` +
                            `Konten lampiran teks:\n${textAttachmentNotes.join('\n\n').slice(0, 12000)}\n\n` +
                            'Gambar yang dikirim adalah halaman PDF. Baca teks pada gambar lalu jawab.',
                        },
                        ...imageParts,
                      ],
                    },
                  ]
                : [
                    {
                      role: 'user',
                      content:
                        `Pertanyaan user:\n${displayMessage}\n\n` +
                        `Konten lampiran:\n${textAttachmentNotes.join('\n\n').slice(0, 16000)}`,
                    },
                  ]),
            ],
          }),
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          const retryReply = retryData?.choices?.[0]?.message?.content
          if (retryReply && typeof retryReply === 'string') {
            reply = retryReply
          }
        }
      } catch {
      }
    }

    reply = reply
      .replace(/^AI:\s*/i, '')
      .trim()

    if (reply.length < 20) {
      reply += '\n\nMau dijelasin lebih detail? 😄'
    }

    history.push({ role: 'assistant', content: reply })

    try {
      if (aiSession) {
        await db.aISession.update({
          where: { id: aiSession.id },
          data: { messages: history },
        })
      } else {
        aiSession = await db.aISession.create({
          data: {
            title: displayMessage.slice(0, 50),
            messages: history,
            userId: session.user.id,
          },
        })
      }
    } catch {
    }

    return NextResponse.json({
      reply,
      sessionId: aiSession?.id ?? null,
    })

  } catch (error) {
    console.error('SERVER ERROR:', error)

    return NextResponse.json({
      error: 'Terjadi kesalahan server',
    }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sessions: any[] = []
  try {
    sessions = await db.aISession.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch {
    sessions = []
  }

  return NextResponse.json(sessions)
}