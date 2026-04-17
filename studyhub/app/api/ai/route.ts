import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { isDevPremium } from '@/lib/dev-premium'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

const FREE_DAILY_LIMIT = 10

// DeepSeek R1: gratis, reasoning terbaik, setara o1
// Fallback: google/gemini-2.0-flash-exp:free (juga gratis dan cepat)
const AI_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-r1:free'

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

  // Burst protection: max 30 AI requests per hour per user
  const rl = checkRateLimit(userId, RATE_LIMITS.ai)
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  try {
    // ── Cek daily limit untuk free user ──────────────────────────────────────
    const sessionUser = session.user as any
    const isPremiumUser = sessionUser?.isPremium || isDevPremium(sessionUser?.email)

    if (!isPremiumUser) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaySessions = await db.aISession.findMany({
        where: { userId, updatedAt: { gte: today } },
        select: { messages: true },
      }).catch(() => [])

      let todayUserMessages = 0
      for (const s of todaySessions) {
        if (Array.isArray(s.messages)) {
          todayUserMessages += (s.messages as any[]).filter((m: any) => m.role === 'user').length
        }
      }

      if (todayUserMessages >= FREE_DAILY_LIMIT) {
        return NextResponse.json({
          error: `Batas ${FREE_DAILY_LIMIT} pesan/hari tercapai. Upgrade ke Premium untuk chat tanpa batas! ⭐`,
          limitReached: true,
          used: todayUserMessages,
          limit: FREE_DAILY_LIMIT,
        }, { status: 429 })
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // Fetch comprehensive user context — semua fitur terintegrasi
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const [
      tasks, completedTasks, schedule, stats, profile,
      notes, flashcardSets, timerStats,
      forumThreads, groupMemberships, classTasks,
      unreadNotifs,
    ] = await Promise.all([
      // Tugas pribadi belum selesai
      db.task.findMany({
        where: { userId, status: { not: 'DONE' } },
        select: { id: true, title: true, deadline: true, priority: true, subject: true, status: true },
        orderBy: { deadline: 'asc' },
        take: 15,
      }),
      // Tugas pribadi yang sudah selesai (terbaru)
      db.task.findMany({
        where: { userId, status: 'DONE' },
        select: { id: true, title: true, deadline: true, subject: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      // Jadwal mingguan
      db.weeklyScheduleSlot.findMany({
        where: { userId },
        select: { dayOfWeek: true, title: true, startTime: true, endTime: true, place: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      // Progress dashboard hari ini
      db.dashboardDay.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { totalTasks: true, doneTasks: true, progress: true, overdueTasks: true },
      }),
      // Profile user
      db.user.findUnique({
        where: { id: userId },
        select: { name: true, points: true, streak: true, institution: true, major: true },
      }),
      // Catatan terbaru
      db.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, tags: true, updatedAt: true },
      }),
      // Flashcard sets
      db.flashcardSet.findMany({
        where: { userId },
        take: 5,
        select: { id: true, title: true, subject: true, _count: { select: { flashcards: true } } },
      }),
      // Timer/Pomodoro stats minggu ini
      db.timerSession.aggregate({
        where: { userId, completedAt: { gte: weekStart } },
        _count: true,
        _sum: { duration: true },
      }),
      // Forum threads terbaru dari user
      db.thread.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, subject: true, upvotes: true, _count: { select: { replies: true } } },
      }),
      // Kelas yang diikuti
      db.groupMember.findMany({
        where: { userId },
        select: { role: true, group: { select: { id: true, name: true, subject: true } } },
      }),
      // Tugas kelas yang belum lewat deadline
      db.classTask.findMany({
        where: {
          group: { members: { some: { userId } } },
          deadline: { gte: new Date() },
        },
        orderBy: { deadline: 'asc' },
        take: 10,
        select: { title: true, deadline: true, priority: true, group: { select: { name: true } } },
      }),
      // Notifikasi belum dibaca
      db.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, message: true, type: true },
      }),
    ])

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const totalStudyMinutes = Math.round((timerStats._sum.duration || 0) / 60)

    const contextStr = `
=== KONTEKS USER SAAT INI ===
User: ${profile?.name || 'User'} | Poin: ${profile?.points} | Streak: ${profile?.streak} hari
${profile?.institution ? `Kampus/Sekolah: ${profile.institution}` : ''}${profile?.major ? ` | Jurusan: ${profile.major}` : ''}

📋 TUGAS PRIBADI (${tasks.length} belum selesai):
${tasks.length > 0 ? tasks.map(t => `- ${t.title} [${t.priority}${t.subject ? `, ${t.subject}` : ''}] ${t.status === 'IN_PROGRESS' ? '(Sedang dikerjakan)' : ''} DL: ${t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Tanpa deadline'}`).join('\n') : 'Tidak ada tugas aktif.'}

✅ TUGAS SELESAI (${completedTasks.length} terakhir):
${completedTasks.length > 0 ? completedTasks.map(t => `- ${t.title}${t.subject ? ` [${t.subject}]` : ''} — selesai ${new Date(t.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join('\n') : 'Belum ada tugas yang diselesaikan.'}

📚 TUGAS KELAS (${classTasks.length} mendatang):
${classTasks.length > 0 ? classTasks.map(t => `- [${t.group.name}] ${t.title} [${t.priority}] DL: ${t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}`).join('\n') : 'Tidak ada tugas kelas.'}

📅 JADWAL MINGGUAN:
${schedule.length > 0 ? schedule.map(s => `- ${dayNames[s.dayOfWeek]}: ${s.title} (${s.startTime || '?'}${s.endTime ? '-' + s.endTime : ''})${s.place ? ' @ ' + s.place : ''}`).join('\n') : 'Belum ada jadwal.'}

🏫 KELAS DIIKUTI (${groupMemberships.length}):
${groupMemberships.length > 0 ? groupMemberships.map(g => `- ${g.group.name}${g.group.subject ? ` (${g.group.subject})` : ''} [${g.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}]`).join('\n') : 'Belum bergabung kelas.'}

📓 CATATAN TERBARU (${notes.length}):
${notes.length > 0 ? notes.map(n => `- "${n.title}"${n.tags.length > 0 ? ` [${n.tags.join(', ')}]` : ''}`).join('\n') : 'Belum ada catatan.'}

🃏 FLASHCARD SETS (${flashcardSets.length}):
${flashcardSets.length > 0 ? flashcardSets.map(f => `- "${f.title}"${f.subject ? ` (${f.subject})` : ''} — ${f._count.flashcards} kartu`).join('\n') : 'Belum ada flashcard.'}

⏱️ STATISTIK BELAJAR (Minggu Ini):
- Sesi Pomodoro: ${timerStats._count || 0} sesi
- Total Durasi: ${totalStudyMinutes} menit (${(totalStudyMinutes / 60).toFixed(1)} jam)

💬 FORUM (Thread Terbaru):
${forumThreads.length > 0 ? forumThreads.map(t => `- "${t.title}"${t.subject ? ` [${t.subject}]` : ''} — ${t.upvotes} upvote, ${t._count.replies} balasan`).join('\n') : 'Belum ada thread.'}

📊 PROGRESS HARI INI:
- Total Tugas: ${stats?.totalTasks || 0} | Selesai: ${stats?.doneTasks || 0} | Overdue: ${stats?.overdueTasks || 0}
- Progress: ${stats?.progress || 0}%

🔔 NOTIFIKASI BELUM DIBACA (${unreadNotifs.length}):
${unreadNotifs.length > 0 ? unreadNotifs.map(n => `- [${n.type}] ${n.title}: ${n.message.slice(0, 60)}`).join('\n') : 'Semua notifikasi sudah dibaca.'}
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

    const userName = ss.userName || profile?.name || 'Kamu'
    const botName = ss.botName || 'StudyHub AI'
    const lang = ss.language === 'en' ? 'English' : 'Bahasa Indonesia'
    const tone = toneMap[ss.tone] || toneMap['genz']
    const detail = detailMap[ss.detailLevel] || detailMap['normal']
    const emoji = ss.emojiLevel === 'minim' ? 'Gunakan emoji sesekali saja (1-2 per respons).' : 'Gunakan emoji yang relevan untuk membuat percakapan hidup, tapi jangan berlebihan.'

    const sysContent = `# Identitas
Kamu adalah **${botName}**, asisten belajar AI pribadi ${userName} di platform **StudyHub**.
Kamu bukan chatbot biasa — kamu tahu semua data belajar ${userName} secara real-time dan bisa membantu secara personal.

# Gaya Komunikasi
- Bahasa: ${lang}
- Tone: ${tone}
- Detail: ${detail}
- Emoji: ${emoji}
- ${modeInstruction}

# Aturan Format Respons (WAJIB DIIKUTI)

## Kapan pakai TABEL markdown:
- Saat menampilkan jadwal mingguan → tabel dengan kolom: Hari | Mata Kuliah | Waktu | Tempat
- Saat membandingkan tugas/prioritas → tabel dengan kolom: Tugas | Mapel | Deadline | Prioritas
- Saat merangkum progress → tabel ringkas
- Saat ada 3+ item yang punya atribut yang sama

## Kapan pakai BULLET LIST:
- Tips dan saran (3+ item)
- Langkah-langkah
- Daftar sederhana tanpa banyak atribut

## Kapan pakai HEADING (##):
- Respons panjang dengan beberapa topik berbeda
- Laporan atau ringkasan lengkap

## JANGAN:
- Jangan pakai tabel untuk respons pendek/casual
- Jangan pakai heading untuk pertanyaan singkat
- Jangan ulangi seluruh konteks user di setiap respons

# Contoh Format yang Baik

**Contoh 1 — User tanya jadwal:**
> "Jadwal kamu minggu ini:"
> | Hari | Mata Kuliah | Waktu | Tempat |
> |------|------------|-------|--------|
> | Senin | Pemrograman | 08:00–10:00 | Lab A |
> | Rabu | Matematika | 13:00–15:00 | R.204 |

**Contoh 2 — User tanya tugas deadline:**
> "Ini tugas yang perlu kamu selesaikan segera 🔥"
> | Tugas | Mapel | Deadline | Prioritas |
> |-------|-------|----------|-----------|
> | UTS Essay | Bahasa Indonesia | 20 Apr, 23:59 | 🔴 Tinggi |
> | Laporan Lab | Fisika | 22 Apr, 08:00 | 🟡 Sedang |

**Contoh 3 — Pertanyaan materi:**
Jawab langsung dengan penjelasan yang clear, pakai bullet jika ada langkah-langkah.

# Aturan Data User (KRITIS)
1. **HANYA** gunakan data dari KONTEKS USER di bawah. Jangan karang data yang tidak ada.
2. Jika data tidak ada di konteks → katakan "belum ada di catatanmu" atau "belum diinput".
3. Jika ada tugas mendekati deadline → proaktif ingatkan dengan ramah.
4. Jika streak atau poin bagus → beri pujian singkat yang tulus.

# Navigasi StudyHub (sertakan link saat relevan)
- [📝 Tugas](/tasks) — kelola tugas & deadline
- [📅 Kalender](/calendar) — jadwal & absensi
- [📓 Catatan](/notes) — tulis & baca catatan
- [🃏 Flashcard](/flashcards) — kartu latihan
- [⏱️ Pomodoro](/timer) — mulai sesi fokus
- [💬 Forum](/forum) — diskusi dengan teman
- [🏫 Kelas](/kelas) — tugas & info kelas
- [📊 Analitik](/analytics) — statistik belajar
- [🏆 Leaderboard](/leaderboard) — peringkat

# Konteks Real-Time ${userName}
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