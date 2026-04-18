import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { isDevPremium } from '@/lib/dev-premium'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

const FREE_DAILY_LIMIT = 10

// Groq — GPU free, lebih stabil & cepat
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // Main model — powerful & fast
  'mixtral-8x7b-32768',        // Fallback
  'llama-3.1-8b-instant',      // Fallback 2 — lebih cepat
]

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
      unreadNotifs, pdfDocs, videoSummaries, classAnnouncements,
    ] = await Promise.all([
      // Tugas pribadi belum selesai (include ID untuk actions)
      db.task.findMany({
        where: { userId, status: { not: 'DONE' } },
        select: { id: true, title: true, deadline: true, priority: true, subject: true, status: true, description: true },
        orderBy: { deadline: 'asc' },
        take: 20,
      }),
      // Tugas pribadi yang sudah selesai (terbaru)
      db.task.findMany({
        where: { userId, status: 'DONE' },
        select: { id: true, title: true, deadline: true, subject: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      // Jadwal mingguan (include ID untuk actions)
      db.weeklyScheduleSlot.findMany({
        where: { userId },
        select: { id: true, dayOfWeek: true, title: true, startTime: true, endTime: true, place: true },
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
      // Catatan — include konten (dipotong 500 char)
      db.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, content: true, tags: true, updatedAt: true },
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
      // PDF Library
      db.pdfDocument.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, title: true, createdAt: true },
      }).catch(() => [] as any[]),
      // Video Summaries
      db.videoSummary.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, createdAt: true },
      }).catch(() => [] as any[]),
      // Pengumuman kelas terbaru
      db.classAnnouncement.findMany({
        where: { group: { members: { some: { userId } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, message: true, createdAt: true, group: { select: { name: true } } },
      }).catch(() => [] as any[]),
    ])

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const totalStudyMinutes = Math.round((timerStats._sum.duration || 0) / 60)

    const fmt = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Tanpa deadline'

    const contextStr = `
=== DATA REAL-TIME ${(profile?.name || 'User').toUpperCase()} ===
👤 Profil: ${profile?.name} | Poin: ${profile?.points} | Streak: ${profile?.streak} hari${profile?.institution ? ` | ${profile.institution}` : ''}${profile?.major ? ` — ${profile.major}` : ''}

📊 PROGRESS HARI INI: ${stats?.doneTasks || 0}/${stats?.totalTasks || 0} tugas selesai (${stats?.progress || 0}%) | Overdue: ${stats?.overdueTasks || 0}
⏱️ BELAJAR MINGGU INI: ${timerStats._count || 0} sesi Pomodoro | ${totalStudyMinutes} menit (${(totalStudyMinutes / 60).toFixed(1)} jam)

📋 TUGAS PRIBADI AKTIF (${tasks.length}):
${tasks.length > 0 ? tasks.map(t => `- [ID:${t.id}] "${t.title}" | Status:${t.status} | Prioritas:${t.priority}${t.subject ? ` | Mapel:${t.subject}` : ''} | DL:${fmt(t.deadline)}`).join('\n') : 'Tidak ada tugas aktif.'}

✅ TUGAS SELESAI TERBARU:
${completedTasks.length > 0 ? completedTasks.map(t => `- [ID:${t.id}] "${t.title}"${t.subject ? ` [${t.subject}]` : ''} — ${fmt(t.updatedAt)}`).join('\n') : 'Belum ada.'}

📚 TUGAS KELAS MENDATANG (${classTasks.length}):
${classTasks.length > 0 ? classTasks.map(t => `- [${t.group.name}] "${t.title}" | ${t.priority} | DL:${fmt(t.deadline)}`).join('\n') : 'Tidak ada.'}

📅 JADWAL MINGGUAN PRIBADI:
${schedule.length > 0 ? schedule.map(s => `- [ID:${s.id}] ${dayNames[s.dayOfWeek]}: "${s.title}" | ${s.startTime || '?'}-${s.endTime || '?'}${s.place ? ` @ ${s.place}` : ''}`).join('\n') : 'Belum ada jadwal.'}

🏫 KELAS (${groupMemberships.length}):
${groupMemberships.length > 0 ? groupMemberships.map(g => `- ${g.group.name}${g.group.subject ? ` (${g.group.subject})` : ''} [${g.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}]`).join('\n') : 'Belum bergabung kelas.'}

📣 PENGUMUMAN KELAS TERBARU:
${classAnnouncements.length > 0 ? classAnnouncements.map((a: any) => `- [${a.group.name}] "${a.title}": ${a.message?.slice(0, 120) || '-'}`).join('\n') : 'Tidak ada pengumuman.'}

📓 CATATAN (${notes.length}) — dengan tanggal update:
${notes.length > 0 ? notes.map(n => `- [ID:${n.id}] "${n.title}" | Diupdate: ${new Date(new Date(n.updatedAt).getTime() + 7*3600000).toISOString().slice(0, 10)}${n.tags.length > 0 ? ` | #${n.tags.join(' #')}` : ''}\n  Isi: ${String(n.content || '').slice(0, 200).replace(/\n/g, ' ')}...`).join('\n') : 'Belum ada catatan.'}

🃏 FLASHCARD SETS:
${flashcardSets.length > 0 ? flashcardSets.map(f => `- "${f.title}"${f.subject ? ` (${f.subject})` : ''} — ${f._count.flashcards} kartu`).join('\n') : 'Belum ada.'}

📄 PDF LIBRARY (${pdfDocs.length}):
${pdfDocs.length > 0 ? pdfDocs.map((p: any) => `- "${p.title}"`).join('\n') : 'Belum ada PDF.'}

🎬 VIDEO SUMMARY (${videoSummaries.length}):
${videoSummaries.length > 0 ? videoSummaries.map((v: any) => `- "${v.title}"`).join('\n') : 'Belum ada.'}

💬 FORUM: ${forumThreads.length > 0 ? forumThreads.map(t => `"${t.title}" (${t.upvotes} upvote)`).join(', ') : 'Belum ada thread.'}

🔔 NOTIFIKASI BELUM DIBACA:
${unreadNotifs.length > 0 ? unreadNotifs.map(n => `- ${n.title}: ${n.message.slice(0, 80)}`).join('\n') : 'Semua sudah dibaca.'}
================`.trim()

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

    // ── Waktu sekarang dalam WIB (UTC+7) ──────────────────────────────────────
    const nowWIB = new Date(Date.now() + 7 * 3600 * 1000)
    const todayISO = nowWIB.toISOString().slice(0, 10)
    const kemarin = new Date(nowWIB.getTime() - 86400000).toISOString().slice(0, 10)
    const tomorrowISO = new Date(nowWIB.getTime() + 86400000).toISOString().slice(0, 10)
    const lusaISO = new Date(nowWIB.getTime() + 2 * 86400000).toISOString().slice(0, 10)
    const nextWeekISO = new Date(nowWIB.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    const dayNow = dayNames[nowWIB.getUTCDay()]
    const timeNow = nowWIB.toISOString().slice(11, 16)
    const nextMondayISO = (() => {
      const d = new Date(nowWIB)
      d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7))
      return d.toISOString().slice(0, 10)
    })()

    const sysContent = `# Identitas
Kamu adalah **${botName}**, asisten belajar AI pribadi **${userName}** di platform **StudyHub**.
Kamu bukan chatbot generik — kamu tahu semua data belajar ${userName} real-time dan bisa langsung ambil aksi.

# Waktu Sekarang (WIB)
- Hari & Tanggal: **${dayNow}, ${todayISO}** | Jam: ${timeNow} WIB
- Kemarin/semalem: ${kemarin}
- Besok: ${tomorrowISO} | Lusa: ${lusaISO}
- Minggu depan (7 hari): ${nextWeekISO} | Senin depan: ${nextMondayISO}
- "Semalem/kemarin" = ${kemarin} | "besok" = ${tomorrowISO} | "lusa" = ${lusaISO}
- "Minggu depan" = sekitar ${nextWeekISO} | "Jumat ini" = hitung dari ${todayISO}
- Default jam deadline jika tidak disebutkan: **23:59:00**

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

# Klasifikasi Intent & Cara Tangani

## Manajemen Tugas
- **"buat/tambah tugas [X]"** → Jika judul ada: langsung buat. Jika tidak: tanya "Tugasnya apa? Deadline kapan?"
- **"tugas apa yang belum"** / **"ada deadline"** → Tampilkan tabel tugas aktif, urutkan terdekat
- **"tugas [X] udah selesai"** / **"mark done"** → Cari ID di konteks → langsung edit_task status=DONE
- **"hapus tugas [X]"** → Konfirmasi dulu, baru hapus setelah user setuju
- **"overdue"** / **"telat"** → List semua tugas yang deadlinenya sudah lewat hari ini (${todayISO})

## Jadwal & Kalender
- **"jadwal hari ini"** → Filter jadwal hari ${dayNow} (dayOfWeek=${nowWIB.getUTCDay()})
- **"besok ada apa"** / **"jadwal besok"** → Filter dayOfWeek=${(nowWIB.getUTCDay() + 1) % 7}
- **"jadwal minggu ini"** → Tampilkan tabel semua slot jadwal
- **"tambahin jadwal [X]"** → Tanya detail yang kurang, lalu create_schedule

## Catatan
- **"buat catatan"** / **"catat"** → Buat langsung jika ada konten, tanya judul jika tidak ada
- **"catatan tentang [X]"** → Cari di konteks notes, tampilkan konten relevan
- **"rangkum catatan [X]"** → Ambil content dari konteks (200 char), rangkum lebih lengkap

## Progress & Motivasi
- **"gimana progress"** / **"udah ngerjain apa"** → Tampilkan: ✅ selesai/total, 🔥 streak, ⭐ poin
- **"ranking/leaderboard"** → Tampilkan poin, arahkan ke [🏆 Leaderboard](/leaderboard)
- **"mau belajar"** / **"rencana belajar"** → Buat jadwal belajar berdasarkan tugas mendatang

## Belajar & Materi
- **"jelaskan [konsep]"** → Jelaskan dengan bahasa sesuai jurusan user jika relevan
- **"soal latihan"** / **"quiz"** → Buat 3-5 soal
- **"mau ujian [X]"** → Lihat tugas terkait + buat rencana belajar

## Small Talk
- **"halo/hai/hi"** → Sapa balik + proaktif tampilkan situasi terkini (overdue/deadline dekat)
- **"makasih"** → "Sama-sama! Ada lagi?"
- **Tidak tahu mau tanya apa** → Tampilkan: ringkasan situasi + 2-3 saran aksi

# Perilaku Proaktif
- Jika ada tugas overdue → sebutkan di awal dengan 🚨 tanpa diminta
- Jika deadline < 24 jam → peringat dengan ⏰
- Jika streak tinggi (>7) → apresiasi
- Jika user sapa tanpa pertanyaan spesifik → tunjukkan ringkasan situasi mereka

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

# ⚡ ACTION SYSTEM — Kamu bisa eksekusi aksi langsung!

Ketika user minta buat/edit/hapus tugas, catatan, atau jadwal — LAKUKAN LANGSUNG dengan menambahkan action block di akhir responmu.

## Format Action Block:
\`\`\`
[STUDYHUB_ACTION:{"type":"...","data":{...}}]
\`\`\`

## Actions yang tersedia:

### Tugas
- Buat tugas baru:
  [STUDYHUB_ACTION:{"type":"create_task","data":{"title":"...","subject":"...","deadline":"2026-04-20T23:59:00","priority":"HIGH|MEDIUM|LOW","description":"..."}}]

- Edit tugas (gunakan ID dari konteks):
  [STUDYHUB_ACTION:{"type":"edit_task","data":{"id":"...","title":"...","status":"TODO|IN_PROGRESS|DONE","priority":"HIGH|MEDIUM|LOW","deadline":"..."}}]

- Hapus tugas:
  [STUDYHUB_ACTION:{"type":"delete_task","data":{"id":"...","title":"..."}}]

### Catatan
- Buat catatan baru:
  [STUDYHUB_ACTION:{"type":"create_note","data":{"title":"...","content":"...","tags":["tag1","tag2"]}}]

### Jadwal
- Tambah jadwal:
  [STUDYHUB_ACTION:{"type":"create_schedule","data":{"dayOfWeek":1,"title":"...","startTime":"08:00","endTime":"10:00","place":"..."}}]

- Hapus jadwal:
  [STUDYHUB_ACTION:{"type":"delete_schedule","data":{"id":"..."}}]

## Aturan Action WAJIB:
1. **Hapus**: Selalu konfirmasi dulu. Setelah user bilang ya/iya/ok → baru eksekusi
2. Untuk buat/edit, langsung eksekusi tanpa tanya lagi jika detailnya sudah jelas
3. Deadline: format ISO 8601. "Besok" = ${tomorrowISO}T23:59:00 | "lusa" = ${lusaISO}T23:59:00
4. dayOfWeek: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
5. Taruh action block di BARIS PALING AKHIR respons, setelah teks konfirmasi
6. Boleh multiple actions dalam satu respons

## Contoh Percakapan:

User: "buat tugas UTS Algoritma besok malam"
AI: "Siap! Langsung aku tambahkan 📋"
[STUDYHUB_ACTION:{"type":"create_task","data":{"title":"UTS Algoritma","subject":"Algoritma","deadline":"${tomorrowISO}T23:00:00","priority":"HIGH"}}]

User: "Laporan Lab udah selesai"
AI: "Keren! ✅ Aku update statusnya."
[STUDYHUB_ACTION:{"type":"edit_task","data":{"id":"ID_DARI_KONTEKS","status":"DONE"}}]

User: "hapus tugas X"
AI: "Yakin hapus **Tugas X**? Gak bisa dibatalkan ya 🗑️"
[JANGAN taruh action block — tunggu konfirmasi dulu]

User: "catat: integral adalah anti-turunan"
AI: "Dicatat! 📓"
[STUDYHUB_ACTION:{"type":"create_note","data":{"title":"Kalkulus — Integral","content":"Integral adalah anti-turunan. Digunakan untuk menghitung luas area di bawah kurva.","tags":["matematika","kalkulus"]}}]

User: "ada tugas apa yang overdue?"
AI: [tampilkan tabel tugas dengan deadline < ${todayISO}, TANPA action block]

# Data Real-Time ${userName}
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

    // Coba model satu per satu — fallback otomatis jika error
    const modelsToTry = GROQ_MODELS

    let aiData: any = null
    let lastErr = ''

    for (const model of modelsToTry) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({ model, messages: aiMessages }),
      })

      if (res.ok) {
        const parsed = await res.json()
        // OpenRouter kadang return 200 tapi isinya error (rate limit dll)
        if (parsed?.error) {
          const code = parsed.error?.code
          if (code === 429 || code === 503 || code === 404) continue
          return NextResponse.json({ error: parsed.error?.message || 'AI Error' }, { status: 500 })
        }
        aiData = parsed
        break
      }

      const errText = await res.text()
      lastErr = errText
      // 404 = model not found, 429 = rate limited, 503 = unavailable → coba model berikutnya
      if (res.status === 404 || res.status === 429 || res.status === 503) continue
      // Error lain (401 auth, dll) → langsung berhenti
      return NextResponse.json({ error: `AI Error: ${errText}` }, { status: 500 })
    }

    if (!aiData) {
      return NextResponse.json(
        { error: 'Semua model AI sedang tidak tersedia. Coba lagi sebentar. ' + lastErr },
        { status: 503 },
      )
    }

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