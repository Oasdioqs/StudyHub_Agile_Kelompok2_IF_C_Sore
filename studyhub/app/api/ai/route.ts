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

type AiTaskCommandDecision = {
  action: 'none' | 'list' | 'create' | 'update' | 'delete'
  confidence?: number
  listMode?: 'all' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'upcoming' | 'overdue' | 'completed'
  targetOrdinal?: number | null
  targetTitle?: string | null
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | null
  wantsAll?: boolean
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
  return /(jadwal|tugas|tgs|deadline|task|to-?do|hari ini|hri ini|minggu ini|belum selesai|overdue|apa aja tugas)/i.test(text)
}

function looksLikeScheduleCreationIntent(text: string) {
  const lower = text.toLowerCase()
  const looksLikeListQuery =
    /(list|daftar|tunjuk(?:in|kan)|lihat(?:kan)?|apa aja)/i.test(lower) ||
    /\b(tugas|task|deadline)\b.*\b(mendatang|upcoming|overdue|hari ini|besok|lusa)\b/i.test(lower)
  const hasStrongCreateVerb =
    /(ingat(?:in|kan)|remind|set jadwal|jadwal(?:kan|in)?|buat(?:kan|in)|catat(?:kan)?|tambah(?:kan|in)?|masuk(?:kan)?)/i.test(lower)
  const hasWeakCreateVerb = /\bbuat\b/i.test(lower) && /^(buat)\s+(?:tugas|task|jadwal)\b/i.test(lower)
  const hasCreateObject = /(jadwal|task|tugas)/i.test(lower)
  const looksLikeDetailFollowUp =
    /\b(judul(?:nya)?|mapel(?:nya)?|mata pelajaran(?:nya)?|deadline)\b/i.test(lower) &&
    /\b(besok|bsk|lusa|hari ini|today|minggu depan|jam)\b/i.test(lower)
  if (looksLikeListQuery && !hasStrongCreateVerb && !hasWeakCreateVerb) return false
  return ((hasStrongCreateVerb || hasWeakCreateVerb) && hasCreateObject) || looksLikeDetailFollowUp
}

function looksLikeTaskUpdateIntent(text: string) {
  return /(ubah|ganti|edit|update|editin|ubahin|ediitn?).*(tugas|task|deadline|tanggal|status|judul)|\b(deadline|tanggal|status)\b.*\b(jadi|ke)\b/i.test(text)
}

function looksLikeTaskDeleteIntent(text: string) {
  const lower = text.toLowerCase()
  const hasDeleteVerb = /(hapus|delete|buang)/i.test(lower)
  const hasTaskObject = /(tugas|task)/i.test(lower)
  const wantsAll = /\b(semua|seluruh|all)\b/i.test(lower)
  const hasOrdinalRef =
    /\b(?:nomor|no\.?|ke)\s*\d+(?:\s*[-–]\s*\d+)?\b/i.test(lower) ||
    /\b\d+\s*[-–]\s*\d+\b/i.test(lower) ||
    /\b(pertama|kedua|ketiga)\b/i.test(lower)
  return hasDeleteVerb && (hasTaskObject || hasOrdinalRef || wantsAll)
}

function looksLikeTaskListIntent(text: string) {
  if (/(hapus|delete|buang)/i.test(text)) return false
  const lower = text.toLowerCase()
  const hasStrongCreateCommand =
    /(buat(?:kan|in)|tambah(?:kan|in)?|catat(?:kan)?|masuk(?:kan)?|jadwal(?:kan|in)?|ingat(?:in|kan))\b.*\b(tugas|task|jadwal)\b/i.test(lower)
  const hasCreateDetailPayload = /\b(judul(?:nya)?|mapel(?:nya)?|mata pelajaran(?:nya)?|deadline)\b/i.test(lower)
  const hasTemporalWord = /\b(besok|bsk|lusa|hari ini|hri ini|today|minggu depan)\b/i.test(lower)
  const asksListExplicit = /\b(list|daftar|tunjuk(?:in|kan)|lihat(?:kan)?|beri(?:tau|tahu)|infokan)\b/i.test(lower)
  const asksListQuestion = /\b(apa aja|apa saja|ada apa)\b/i.test(lower)
  if (hasStrongCreateCommand && !/\b(list|daftar|lihat|tunjuk|infokan|beri(?:tau|tahu))\b/i.test(lower)) return false
  if (hasCreateDetailPayload && hasTemporalWord && !asksListExplicit && !asksListQuestion) return false
  return /(list|daftar|tunjuk(?:in|kan)|lihat(?:kan)?|beri(?:tau|tahu)|infokan).*(tugas|task|tgs|deadline)|\b(apa aja|apa saja|ada apa)\b.*\b(tugas|task|tgs|deadline)\b|\b(tugas|task|tgs)\b.*\b(apa aja|apa saja|ada apa|saat ini|sekarang)\b|\b(list|daftar)\b.*\b(mendatang|upcoming|overdue|hari ini|hri ini|minggu ini|besok|bsk|lusa)\b|\b(tugas|tgs|deadline)\b.*\b(mendatang|upcoming|overdue|hari ini|hri ini|minggu ini|besok|bsk|lusa)\b|\b(?:untuk)\s+(?:besok|bsk|lusa)\b/i.test(lower)
}

function parseStatusFromText(text: string): 'TODO' | 'IN_PROGRESS' | 'DONE' | null {
  if (/(selesai|done|completed|beres|kelar)/i.test(text)) return 'DONE'
  if (/(dikerjakan|di\s*kerjain|dikerjain|lagi\s*di\s*kerjain|in[\s_-]?progress|sedang)/i.test(text)) return 'IN_PROGRESS'
  if (/(belum mulai|belum siap|todo|to[\s_-]?do|not started)/i.test(text)) return 'TODO'
  return null
}

function parseTaskUpdateIntent(text: string) {
  const status = parseStatusFromText(text)
  let deadline = parseDateFromMessage(text)
  const titleMatch =
    text.match(/(?:judul(?:nya)?|nama(?: tugas)?)\s*(?:jadi|ke|:)\s*["“]?([^"”\n,]+)["”]?/i) ||
    text.match(/(?:ganti|ubah)\s+(?:judul|nama)\s+(?:tugas|task)?\s*["“]?([^"”\n,]+)["”]?/i)
  const targetMatch =
    text.match(/(?:tugas|task)\s+["“]?([^"”\n,]+?)["”]?\s+(?:jadi|ke|yang|di|untuk)/i) ||
    text.match(/(?:ubah|ganti|edit|update)\s+(?:tugas|task)\s+["“]?([^"”\n,]+)["”]?/i)
  const newTitle = titleMatch?.[1]?.trim() || null
  const rawTargetTitle = targetMatch?.[1]?.trim() || null
  const normalizedTarget = rawTargetTitle
    ? rawTargetTitle
        .replace(/\b(yg|yang|ga|gak|nggak|dong|ya|yah|pls|please)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : null
  const targetLooksLikeOrdinalRef =
    !!normalizedTarget &&
    /^(?:ke|no\.?|nomor)\s*\d+(?:\s*[-–]\s*\d+)?$/i.test(normalizedTarget)
  const targetTitle = targetLooksLikeOrdinalRef ? null : rawTargetTitle
  const ordinalMatch =
    text.match(/\b(?:ke|no\.?|nomor)\s*(\d{1,3})\b/i) ||
    text.match(/\b(pertama|kedua|ketiga)\b/i)
  const targetOrdinal =
    ordinalMatch?.[1]
      ? Number(ordinalMatch[1])
      : /\bpertama\b/i.test(text)
        ? 1
        : /\bkedua\b/i.test(text)
          ? 2
          : /\bketiga\b/i.test(text)
            ? 3
            : null
  const wantsAll = /\b(semua|seluruh|all)\b/i.test(text)
  const updateScope = parseTaskListIntent(text)
  const hasExplicitDeadlineEdit =
    /\b(deadline|tanggal|jam|waktu)\b.*\b(jadi|ke|diubah|diganti)\b|\b(ubah|ganti|reschedule|maju|mundur|undur)\b.*\b(deadline|tanggal|jam|waktu)\b/i.test(text)
  if (wantsAll && status && !hasExplicitDeadlineEdit) {
    deadline = null
  }
  return { status, deadline, newTitle, targetTitle, targetOrdinal, wantsAll, updateScope }
}

function parseTaskDeleteIntent(text: string) {
  const titleMatch =
    text.match(/(?:hapus|delete|buang)\s+(?:tugas|task)\s+["“]?([^"”\n,]+)["”]?/i) ||
    text.match(/(?:tugas|task)\s+["“]?([^"”\n,]+)["”]?\s+(?:hapus|delete|buang)/i)
  const wantsLatest = /(terakhir|paling baru|latest|terdekat)/i.test(text)
  const ordinalNumbers = new Set<number>()
  const ordRegex = /\b(?:ke|no\.?|nomor)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/gi
  let m: RegExpExecArray | null = null
  while ((m = ordRegex.exec(text)) !== null) {
    const start = Number(m[1])
    const end = m[2] ? Number(m[2]) : start
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end > 0) {
      const from = Math.min(start, end)
      const to = Math.max(start, end)
      for (let i = from; i <= to && i <= from + 30; i += 1) ordinalNumbers.add(i)
    }
  }
  const bareRangeRegex = /\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/g
  while ((m = bareRangeRegex.exec(text)) !== null) {
    const start = Number(m[1])
    const end = Number(m[2])
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end > 0) {
      const from = Math.min(start, end)
      const to = Math.max(start, end)
      for (let i = from; i <= to && i <= from + 30; i += 1) ordinalNumbers.add(i)
    }
  }
  let ordinal: number | null = null
  if (/\b(pertama|ke-?1|nomor 1|no\.?\s*1)\b/i.test(text)) ordinal = 1
  else if (/\b(kedua|ke-?2|nomor 2|no\.?\s*2)\b/i.test(text)) ordinal = 2
  else if (/\b(ketiga|ke-?3|nomor 3|no\.?\s*3)\b/i.test(text)) ordinal = 3
  if (ordinal) ordinalNumbers.add(ordinal)
  const rawTargetTitle = titleMatch?.[1]?.trim() || null
  const normalizedRawTarget = rawTargetTitle
    ? rawTargetTitle
        .replace(/\b(ga|nggak|gak|dong|ya|yah|pls|please)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : null
  const targetLooksLikeIndexRef =
    !!normalizedRawTarget &&
    /^(yg|yang)?\s*(ke|no\.?|nomor)\s*\d+(?:\s*[-–]\s*\d+)?$/i.test(normalizedRawTarget)
  const wantsAll = /\b(semua|seluruh|all)\b/i.test(text)
  return {
    targetTitle: targetLooksLikeIndexRef || ordinalNumbers.size > 0 ? null : rawTargetTitle,
    wantsLatest,
    wantsAll,
    ordinal,
    ordinalNumbers: Array.from(ordinalNumbers).sort((a, b) => a - b),
  }
}

function parseTaskListIntent(text: string) {
  const lower = text.toLowerCase()
  const normalized = lower
    .replace(/\bbesokku\b/g, 'besok')
    .replace(/\blusaku\b/g, 'lusa')
    .replace(/\bhri\b/g, 'hari')
    .replace(/\btgs\b/g, 'tugas')
  if (/\b(?:besok|bsk|buat\s+besok|buat\s+bsk|untuk\s+besok|untuk\s+bsk)\b/.test(normalized)) return 'tomorrow' as const
  if (/\b(?:lusa|buat\s+lusa|untuk\s+lusa)\b/.test(normalized)) return 'day_after_tomorrow' as const
  if (/overdue|terlambat|lewat deadline/.test(normalized)) return 'overdue' as const
  if (/completed|selesai/.test(normalized)) return 'completed' as const
  if (/mendatang|upcoming|deadline/.test(normalized)) return 'upcoming' as const
  if (/hari ini|today/.test(normalized)) return 'today' as const
  return 'all' as const
}

function formatTaskListModeLabel(mode: ReturnType<typeof parseTaskListIntent>) {
  if (mode === 'today') return 'hari ini'
  if (mode === 'tomorrow') return 'besok'
  if (mode === 'day_after_tomorrow') return 'lusa'
  if (mode === 'upcoming') return 'mendatang'
  if (mode === 'completed') return 'selesai'
  if (mode === 'overdue') return 'terlambat'
  return 'semua'
}

type TaskListMode = ReturnType<typeof parseTaskListIntent>
type TaskListContextSnapshot = {
  mode: TaskListMode
  ids: string[]
  generatedAt: string
}

const TASK_LIST_CONTEXT_PREFIX = '[TASK_LIST_CONTEXT]'
const TASK_PENDING_ACTION_PREFIX = '[TASK_PENDING_ACTION]'

type PendingActionPayload =
  | { type: 'none' }
  | { type: 'create'; data: ReturnType<typeof parseScheduleTaskIntent> }
  | { type: 'update'; data: ReturnType<typeof parseTaskUpdateIntent>; listContext: TaskListContextSnapshot | null }
  | { type: 'delete'; data: ReturnType<typeof parseTaskDeleteIntent>; listContext: TaskListContextSnapshot | null }

function serializeTaskListContext(ctx: TaskListContextSnapshot) {
  return `${TASK_LIST_CONTEXT_PREFIX}${JSON.stringify(ctx)}`
}

function serializePendingAction(action: PendingActionPayload) {
  return `${TASK_PENDING_ACTION_PREFIX}${JSON.stringify(action)}`
}

function extractTaskListContextFromMessages(messages: any[]): TaskListContextSnapshot | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg?.role !== 'assistant' || typeof msg?.content !== 'string') continue
    if (!msg.content.startsWith(TASK_LIST_CONTEXT_PREFIX)) continue
    try {
      const parsed = JSON.parse(msg.content.slice(TASK_LIST_CONTEXT_PREFIX.length))
      if (!parsed || !Array.isArray(parsed.ids)) continue
      return {
        mode: parsed.mode || 'all',
        ids: parsed.ids.filter((id: any) => typeof id === 'string'),
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date().toISOString(),
      }
    } catch {
    }
  }
  return null
}

function extractPendingActionFromMessages(messages: any[]): PendingActionPayload | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg?.role !== 'assistant' || typeof msg?.content !== 'string') continue
    if (!msg.content.startsWith(TASK_PENDING_ACTION_PREFIX)) continue
    try {
      const parsed = JSON.parse(msg.content.slice(TASK_PENDING_ACTION_PREFIX.length)) as PendingActionPayload
      if (!parsed || typeof parsed !== 'object') continue
      if ((parsed as any).type === 'none') return null
      return parsed
    } catch {
    }
  }
  return null
}

function isConfirmationMessage(text: string) {
  return /\b(y|ya|iy|iya|yup|yes|oke|ok|lanjut|gas|setuju|simpan|jadiin|confirm)\b/i.test(text.trim())
}

function stripInternalContext(text: string) {
  return String(text || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith(TASK_LIST_CONTEXT_PREFIX))
    .filter((line) => !line.trim().startsWith(TASK_PENDING_ACTION_PREFIX))
    .join('\n')
    .trim()
}

async function inferTaskCommandDecisionWithAI(message: string): Promise<AiTaskCommandDecision | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !message.trim()) return null

  const system = `
Klasifikasikan pesan user untuk command task.
Output WAJIB JSON valid tanpa markdown.
Schema:
{
  "action": "none|list|create|update|delete",
  "confidence": 0..1,
  "listMode": "all|today|tomorrow|day_after_tomorrow|upcoming|overdue|completed|null",
  "targetOrdinal": number|null,
  "targetTitle": string|null,
  "status": "TODO|IN_PROGRESS|DONE|null",
  "wantsAll": boolean
}
Aturan:
- "list tugas besok", "tugas untuk besok", "list tugas buat besokku" => action=list, listMode=tomorrow.
- "tugas lusa" => action=list, listMode=day_after_tomorrow.
- "nambahin tugas besok", "tambah 1 tugas besok", "buat tugas besok" => action=create (BUKAN list).
- "hapus nomor 2", "hapus yg pertama" => action=delete + targetOrdinal.
- "edit status tugas ke 2 jadi selesai", "ubah semua tugas besok jadi belum siap" => action=update (+status, targetOrdinal/wantsAll).
- Jika tidak jelas command task, action=none dengan confidence rendah.
`.trim()

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()
    if (!raw) return null
    const parsed = JSON.parse(raw) as AiTaskCommandDecision
    if (!parsed || typeof parsed !== 'object') return null
    if (!['none', 'list', 'create', 'update', 'delete'].includes(String(parsed.action))) return null
    return parsed
  } catch {
    return null
  }
}

function applyTaskListModeToWhere(
  mode: ReturnType<typeof parseTaskListIntent>,
  _now: Date,
  whereBase: Record<string, any>,
) {
  const jakartaNow = getJakartaNow()
  const jakartaCurrent = createJakartaDate(
    jakartaNow.year,
    jakartaNow.month - 1,
    jakartaNow.day,
    jakartaNow.hour,
    jakartaNow.minute,
  )
  const startToday = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day, 0, 0)
  const endToday = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day, 23, 59)
  const startTomorrow = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day + 1, 0, 0)
  const endTomorrow = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day + 1, 23, 59)
  const startDayAfterTomorrow = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day + 2, 0, 0)
  const endDayAfterTomorrow = createJakartaDate(jakartaNow.year, jakartaNow.month - 1, jakartaNow.day + 2, 23, 59)

  if (mode === 'overdue') {
    whereBase.status = { not: 'DONE' }
    whereBase.deadline = { lt: jakartaCurrent }
  } else if (mode === 'completed') {
    whereBase.status = 'DONE'
  } else if (mode === 'upcoming') {
    whereBase.status = { not: 'DONE' }
    whereBase.deadline = { gte: jakartaCurrent }
  } else if (mode === 'today') {
    whereBase.deadline = { gte: startToday, lte: endToday }
  } else if (mode === 'tomorrow') {
    whereBase.status = { not: 'DONE' }
    whereBase.deadline = { gte: startTomorrow, lte: endTomorrow }
  } else if (mode === 'day_after_tomorrow') {
    whereBase.status = { not: 'DONE' }
    whereBase.deadline = { gte: startDayAfterTomorrow, lte: endDayAfterTomorrow }
  }
}

function getJakartaNow() {
  const now = new Date()
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(now)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0')
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  }
}

function createJakartaDate(
  year: number,
  monthIndex: number,
  day: number,
  hour = 20,
  minute = 0,
) {
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute, 0, 0))
}

function parseDateFromMessage(raw: string) {
  const text = raw.toLowerCase()
  const now = getJakartaNow()
  let date: Date | null = null

  const ymd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  const dmy = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
  const dMonth = text.match(/\b(?:tanggal\s*)?(\d{1,2})\s+(jan|januari|feb|februari|mar|maret|apr|april|mei|may|jun|juni|jul|juli|agu|agt|agustus|aug|sep|september|okt|oct|oktober|nov|november|des|dec|desember)(?:\s+(\d{4}))?\b/)
  const time = text.match(/\b(?:jam\s*)?(\d{1,2})[:.](\d{2})\b/)
  const timeWord = text.match(/\b(?:jam\s*)?(\d{1,2})\s*(pagi|siang|sore|malam)\b/)

  if (ymd) {
    const y = Number(ymd[1]); const m = Number(ymd[2]); const d = Number(ymd[3])
    date = createJakartaDate(y, m - 1, d, 20, 0)
  } else if (dmy) {
    const d = Number(dmy[1]); const m = Number(dmy[2]); const yy = dmy[3] ? Number(dmy[3]) : now.year
    const y = yy < 100 ? 2000 + yy : yy
    date = createJakartaDate(y, m - 1, d, 20, 0)
  } else if (dMonth) {
    const monthMap: Record<string, number> = {
      jan: 0, januari: 0,
      feb: 1, februari: 1,
      mar: 2, maret: 2,
      apr: 3, april: 3,
      mei: 4, may: 4,
      jun: 5, juni: 5,
      jul: 6, juli: 6,
      agu: 7, agt: 7, agustus: 7, aug: 7,
      sep: 8, september: 8,
      okt: 9, oct: 9, oktober: 9,
      nov: 10, november: 10,
      des: 11, dec: 11, desember: 11,
    }
    const d = Number(dMonth[1])
    const m = monthMap[dMonth[2]]
    const y = dMonth[3] ? Number(dMonth[3]) : now.year
    if (m !== undefined) date = createJakartaDate(y, m, d, 20, 0)
  } else if (/\blusa\b/.test(text)) {
    date = createJakartaDate(now.year, now.month - 1, now.day + 2, 20, 0)
  } else if (/\b(besok|bsk)\b/.test(text)) {
    date = createJakartaDate(now.year, now.month - 1, now.day + 1, 20, 0)
  } else if (/hari ini|today/.test(text)) {
    date = createJakartaDate(now.year, now.month - 1, now.day, 20, 0)
  } else if (/minggu depan/.test(text)) {
    date = createJakartaDate(now.year, now.month - 1, now.day + 7, 20, 0)
  }

  if (!date) return null
  if (time) {
    date.setHours(Number(time[1]), Number(time[2]), 0, 0)
  } else if (timeWord) {
    let hour = Number(timeWord[1])
    const part = timeWord[2]
    if (part === 'pagi' && hour === 12) hour = 0
    if ((part === 'siang' || part === 'sore' || part === 'malam') && hour < 12) hour += 12
    date.setHours(hour, 0, 0, 0)
  }
  return Number.isNaN(date.getTime()) ? null : date
}

function parseScheduleTaskIntent(text: string) {
  const deadline = parseDateFromMessage(text)
  const lower = text.toLowerCase()

  const titleSeed =
    text
      .replace(/(?:tolong|please|bantu(?:in)?|dong)/gi, ' ')
      .replace(/(?:ingat(?:in|kan)|remind(?: me)?(?: to)?|set jadwal(?: untuk)?|jadwal(?:kan|in)?|buat(?:kan)?(?: aku)?(?: tugas|task|jadwal)?|catat(?:kan)?)/gi, ' ')
      .replace(/(?:hari ini|besok|lusa|minggu depan|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|jam\s*\d{1,2}[:.]\d{2})/gi, ' ')
      .replace(/[.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const explicitTitle =
    text.match(/(?:judul(?:nya)?\s*[;:=-]+\s*)([^,\n]+)/i)?.[1]?.trim() ||
    text.match(/(?:tugasnya\s*[;:=-]+\s*)([^,\n]+)/i)?.[1]?.trim() ||
    ''
  const isLikelyDetailFollowUp =
    !/(buat(?:kan|in)?|tambah(?:kan|in)?|catat(?:kan)?|jadwal(?:kan|in)?|masuk(?:kan)?|ingat(?:in|kan)?)/i.test(lower)
  const leadSegment = text.split(/[,\n]/)[0]?.trim() || ''
  const leadSanitized = leadSegment
    .replace(/[;:]/g, ' ')
    .replace(/\b(judul(?:nya)?|mapel(?:nya)?|mata pelajaran(?:nya)?|deadline)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const mergedTitleSeed = explicitTitle || titleSeed
  const inferredCoreTitle = mergedTitleSeed
    .replace(/\b(aku|au|saya|kami|kita|tolong|please|dong|ya|yg|yang|buat|buatin|buatkan|bantu|tambah(?:in|kan)?|catat(?:kan)?|jadwal(?:kan|in)?|tugas|task|jadwal|untuk|utk|untk|besok|bsk|lusa|hari ini|minggu depan|bisa|boleh|ga|gak|nggak|nya|nih|aja)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const inferredWords = inferredCoreTitle ? inferredCoreTitle.split(' ').filter(Boolean) : []
  const meaningfulWords = inferredWords.filter((w) => w.length >= 3)
  const subjectMatch =
    text.match(/(?:mapel(?:nya)?|mata pelajaran(?:nya)?|subject(?:nya)?)\s*[:=-]?\s*([a-zA-Z ]{2,40})/i) ||
    text.match(/(?:untuk|buat)\s+(?:mapel|matkul)\s+([a-zA-Z ]{2,40})/i)
  const subject = subjectMatch?.[1]?.trim() || null
  const fallbackTitle =
    !explicitTitle &&
    isLikelyDetailFollowUp &&
    (subject || deadline) &&
    leadSanitized.length >= 3
      ? leadSanitized
      : ''
  const effectiveTitleSeed = explicitTitle || fallbackTitle || inferredCoreTitle || mergedTitleSeed
  const title = effectiveTitleSeed ? effectiveTitleSeed.charAt(0).toUpperCase() + effectiveTitleSeed.slice(1) : 'Tugas baru'
  const priority =
    /penting|urgent|segera|jangan sampai lupa/.test(lower) ? 'HIGH' :
    'LOW'

  const lacksTitleDetail =
    !effectiveTitleSeed ||
    effectiveTitleSeed.length < 3 ||
    /^buat(?:kan)?$|^tugas$|^task$|^jadwal$|^tugas baru$/i.test(effectiveTitleSeed.toLowerCase())
  const hasDeadlineDetail = !!deadline
  const hasSubjectDetail = !!subject
  const hasTitleDetail = !lacksTitleDetail
  return {
    title,
    deadline,
    priority,
    subject,
    lacksTitleDetail,
    hasTitleDetail,
    hasSubjectDetail,
    hasDeadlineDetail,
  }
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
      taskFormSubmission,
    } = await req.json()

    const userMessage = String(message || '').trim()
    const formSubmission =
      taskFormSubmission &&
      typeof taskFormSubmission === 'object' &&
      typeof taskFormSubmission.title === 'string' &&
      typeof taskFormSubmission.subject === 'string' &&
      typeof taskFormSubmission.deadline === 'string'
        ? {
            title: String(taskFormSubmission.title).trim(),
            subject: String(taskFormSubmission.subject).trim(),
            deadline: String(taskFormSubmission.deadline).trim(),
            status: typeof taskFormSubmission.status === 'string' ? String(taskFormSubmission.status).trim().toUpperCase() : '',
            priority: typeof taskFormSubmission.priority === 'string' ? String(taskFormSubmission.priority).trim().toUpperCase() : '',
          }
        : null
    const aiTaskDecision = await inferTaskCommandDecisionWithAI(userMessage)
    const aiDecisionConfident = Number(aiTaskDecision?.confidence || 0) >= 0.6
    const explicitCreatePhrase =
      /(tambah(?:kan|in)?|catat(?:kan)?|masuk(?:kan)?|jadwal(?:kan|in)?|ingat(?:in|kan)?|buatkan|buatin|bikin(?:in|kan)?)/i.test(userMessage) &&
      /(tugas|task|jadwal)/i.test(userMessage)
    const explicitListQuery =
      /(list|daftar|tunjuk(?:in|kan)|lihat(?:kan)?|beri(?:tau|tahu)|infokan).*(tugas|task|tgs|deadline)|\b(apa aja|apa saja|ada apa)\b.*\b(tugas|task|tgs|deadline)\b|\b(tugas|task|tgs)\b.*\b(hari ini|hri ini|today|besok|bsk|lusa|mendatang|upcoming|overdue)\b/i.test(userMessage)
    let shouldUpdateTask = looksLikeTaskUpdateIntent(userMessage)
    let shouldDeleteTask = looksLikeTaskDeleteIntent(userMessage)
    let shouldListTask = looksLikeTaskListIntent(userMessage)
    let shouldAutoCreateSchedule =
      looksLikeScheduleCreationIntent(userMessage) &&
      !shouldUpdateTask &&
      !shouldDeleteTask &&
      !shouldListTask
    if (aiTaskDecision && aiDecisionConfident) {
      shouldUpdateTask = aiTaskDecision.action === 'update'
      shouldDeleteTask = aiTaskDecision.action === 'delete'
      shouldListTask = aiTaskDecision.action === 'list'
      shouldAutoCreateSchedule = aiTaskDecision.action === 'create'
      if (explicitCreatePhrase && shouldListTask && !shouldUpdateTask && !shouldDeleteTask) {
        shouldListTask = false
        shouldAutoCreateSchedule = true
      }
    }
    if (explicitListQuery && !explicitCreatePhrase) {
      shouldListTask = true
      shouldAutoCreateSchedule = false
      shouldUpdateTask = false
      shouldDeleteTask = false
    }
    let isTaskCommandIntent =
      shouldAutoCreateSchedule || shouldUpdateTask || shouldDeleteTask || shouldListTask
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
    const contextMessagePool = [
      ...(Array.isArray(aiSession?.messages) ? (aiSession.messages as any[]) : []),
      ...(Array.isArray(historyOverride) ? historyOverride : []),
    ]
    const lastListContext = extractTaskListContextFromMessages(contextMessagePool)
    const pendingAction = extractPendingActionFromMessages(contextMessagePool)
    const isConfirmingPending = !!pendingAction && isConfirmationMessage(userMessage)
    if (isConfirmingPending && pendingAction?.type) {
      if (pendingAction.type === 'create') {
        shouldAutoCreateSchedule = true
        shouldUpdateTask = false
        shouldDeleteTask = false
        shouldListTask = false
      } else if (pendingAction.type === 'update') {
        shouldAutoCreateSchedule = false
        shouldUpdateTask = true
        shouldDeleteTask = false
        shouldListTask = false
      } else if (pendingAction.type === 'delete') {
        shouldAutoCreateSchedule = false
        shouldUpdateTask = false
        shouldDeleteTask = true
        shouldListTask = false
      }
      isTaskCommandIntent = true
    }
    const looksLikeCreateDetailPayload =
      /\b(judul(?:nya)?|mapel(?:nya)?|mata pelajaran(?:nya)?|deadline|jam)\b/i.test(userMessage)
    const isCreateDetailFollowUp =
      pendingAction?.type === 'create' &&
      !isConfirmingPending &&
      looksLikeCreateDetailPayload &&
      !explicitListQuery
    if (isCreateDetailFollowUp) {
      shouldAutoCreateSchedule = true
      shouldListTask = false
      shouldUpdateTask = false
      shouldDeleteTask = false
      isTaskCommandIntent = true
    }
    let autoScheduleSummary = ''
    let autoScheduleCreated = false
    let autoUpdateSummary = ''
    let autoDeleteSummary = ''
    let autoListSummary = ''
    let autoListContext = ''
    let autoPendingActionContext = ''
    if (formSubmission) {
      const formMissing: string[] = []
      if (!formSubmission.title) formMissing.push('judul')
      if (!formSubmission.subject) formMissing.push('mapel')
      if (!formSubmission.deadline) formMissing.push('waktu/deadline')
      const parsedDeadline = formSubmission.deadline ? parseDateFromMessage(formSubmission.deadline) : null
      if (!parsedDeadline) formMissing.push('format deadline valid')
      if (formMissing.length > 0) {
        autoScheduleSummary =
          `Data form belum valid: ${Array.from(new Set(formMissing)).join(', ')}. ` +
          'Coba isi ulang form Add Task (contoh deadline: besok jam 19:00).'
      } else {
        const safeStatus = ['TODO', 'IN_PROGRESS', 'DONE'].includes(formSubmission.status)
          ? formSubmission.status
          : 'TODO'
        const safePriority = ['LOW', 'MEDIUM', 'HIGH'].includes(formSubmission.priority)
          ? formSubmission.priority
          : 'LOW'
        try {
          await db.$transaction([
            db.task.create({
              data: {
                title: formSubmission.title,
                subject: formSubmission.subject,
                deadline: parsedDeadline,
                status: safeStatus as any,
                priority: safePriority as any,
                userId: session.user.id,
              },
            }),
            db.notification.create({
              data: {
                userId: session.user.id,
                type: 'SCHEDULE_CREATED_BY_AI',
                title: 'Jadwal ditambahkan oleh AI',
                message: `AI menambahkan tugas "${formSubmission.title}" untuk ${parsedDeadline!.toLocaleString('id-ID')}.`,
                link: '/tasks',
              },
            }),
          ])
          autoScheduleSummary =
            `✅ Mantap! Tugas "${formSubmission.title}" sukses disimpan.\n` +
            `• Mapel: ${formSubmission.subject}\n` +
            `• Deadline: ${parsedDeadline!.toLocaleString('id-ID')}\n` +
            `• Status: ${safeStatus}\n` +
            `• Prioritas: ${safePriority}\n` +
            'Kalau mau, aku bisa lanjut list tugas hari ini/besok juga.'
          autoScheduleCreated = true
        } catch {
          autoScheduleSummary = 'Gagal menyimpan tugas dari form karena gangguan server.'
        }
      }
      shouldAutoCreateSchedule = false
      shouldUpdateTask = false
      shouldDeleteTask = false
      shouldListTask = false
      isTaskCommandIntent = true
      autoPendingActionContext = serializePendingAction({ type: 'none' })
    }
    if (pendingAction && !isConfirmingPending && isTaskCommandIntent && !isCreateDetailFollowUp) {
      autoPendingActionContext = serializePendingAction({ type: 'none' })
    }

    if (shouldAutoCreateSchedule) {
      if (!isConfirmingPending && pendingAction?.type === 'create' && !isCreateDetailFollowUp) {
        autoScheduleSummary = 'Kamu masih punya aksi tambah tugas yang belum dikonfirmasi. Balas `ya` untuk lanjut atau kirim perintah baru.'
      }
      const parsed = parseScheduleTaskIntent(userMessage)
      if (parsed) {
        const missingFields: string[] = []
        if (!parsed.hasTitleDetail) missingFields.push('judul')
        if (!parsed.hasSubjectDetail) missingFields.push('mapel')
        if (!parsed.hasDeadlineDetail) missingFields.push('waktu/deadline')
        if (missingFields.length > 0) {
          autoScheduleSummary =
            `Sebelum aku simpan, info ini belum lengkap: ${missingFields.join(', ')}. ` +
            'Isi form Add Task di bubble chat ini lalu klik tombol Add.'
        } else {
        if (!isConfirmingPending) {
          autoScheduleSummary = `Konfirmasi dulu ya: simpan tugas "${parsed.title}"${parsed.subject ? ` (mapel ${parsed.subject})` : ''}${parsed.deadline ? ` pada ${parsed.deadline.toLocaleString('id-ID')}` : ''}? Balas \`ya\` untuk simpan.`
          autoPendingActionContext = serializePendingAction({ type: 'create', data: parsed })
        } else if (pendingAction?.type === 'create') {
        try {
          const pendingCreate = pendingAction.data
          await db.$transaction([
            db.task.create({
              data: {
                title: pendingCreate.title,
                deadline: pendingCreate.deadline,
                priority: pendingCreate.priority as any,
                subject: pendingCreate.subject,
                userId: session.user.id,
              },
            }),
            db.notification.create({
              data: {
                userId: session.user.id,
                type: 'SCHEDULE_CREATED_BY_AI',
                title: 'Jadwal ditambahkan oleh AI',
                message: pendingCreate.deadline
                  ? `AI menambahkan jadwal "${pendingCreate.title}" untuk ${pendingCreate.deadline.toLocaleString('id-ID')}.`
                  : `AI menambahkan tugas "${pendingCreate.title}" tanpa deadline.`,
                link: '/calendar',
              },
            }),
          ])
          const deadlineLabel = pendingCreate.deadline ? pendingCreate.deadline.toLocaleString('id-ID') : ''
          autoScheduleSummary =
            pendingCreate.deadline
              ? `✅ Oke, tugas "${pendingCreate.title}" sudah aku simpan untuk ${deadlineLabel} (prioritas ${pendingCreate.priority}).`
              : `✅ Oke, tugas "${pendingCreate.title}" sudah aku simpan (tanpa deadline, prioritas ${pendingCreate.priority}).`
          autoScheduleCreated = true
          autoPendingActionContext = serializePendingAction({ type: 'none' })
        } catch {
          autoScheduleSummary = 'AI mencoba menyimpan jadwal, tapi gagal karena gangguan server.'
        }
        }
        }
      } else {
        autoScheduleSummary =
          'AI mendeteksi permintaan buat jadwal, tapi belum menemukan tanggal/jam yang jelas dari pesan user.'
      }
    }

    if (shouldUpdateTask) {
      const parsedUpdate = parseTaskUpdateIntent(userMessage)
      if (aiTaskDecision && aiDecisionConfident && aiTaskDecision.action === 'update') {
        if (aiTaskDecision.status) parsedUpdate.status = aiTaskDecision.status
        if (typeof aiTaskDecision.targetOrdinal === 'number' && aiTaskDecision.targetOrdinal > 0) {
          parsedUpdate.targetOrdinal = aiTaskDecision.targetOrdinal
        }
        if (aiTaskDecision.targetTitle && !parsedUpdate.targetTitle) {
          parsedUpdate.targetTitle = aiTaskDecision.targetTitle
        }
        if (typeof aiTaskDecision.wantsAll === 'boolean') {
          parsedUpdate.wantsAll = aiTaskDecision.wantsAll
        }
      }
      if (!isConfirmingPending) {
        const previewBits: string[] = []
        if (parsedUpdate.status) previewBits.push(`status -> ${parsedUpdate.status}`)
        if (parsedUpdate.deadline) previewBits.push(`deadline -> ${parsedUpdate.deadline.toLocaleString('id-ID')}`)
        if (parsedUpdate.newTitle) previewBits.push(`judul -> "${parsedUpdate.newTitle}"`)
        const targetLabel = parsedUpdate.wantsAll
          ? `semua tugas (${parsedUpdate.updateScope})`
          : parsedUpdate.targetOrdinal
            ? `tugas #${parsedUpdate.targetOrdinal}`
            : parsedUpdate.targetTitle
              ? `tugas "${parsedUpdate.targetTitle}"`
              : '1 tugas terdekat'
        if (previewBits.length) {
          autoUpdateSummary = `Konfirmasi dulu ya: update ${targetLabel} dengan ${previewBits.join(', ')}? Balas \`ya\` untuk lanjut.`
          autoPendingActionContext = serializePendingAction({ type: 'update', data: parsedUpdate, listContext: lastListContext })
        } else {
          autoUpdateSummary = 'Perubahan belum jelas. Sebutkan mau ubah tanggal/status/judulnya.'
        }
      } else if (pendingAction?.type !== 'update') {
        autoUpdateSummary = 'Aksi yang menunggu konfirmasi bukan update. Kirim perintah update lagi kalau mau ubah tugas.'
      } else {
      try {
        const parsedUpdate = pendingAction.data
        const confirmedListContext = pendingAction.listContext
        if (parsedUpdate.wantsAll) {
          const bulkData: Record<string, any> = {}
          if (parsedUpdate.status) bulkData.status = parsedUpdate.status
          if (parsedUpdate.deadline) bulkData.deadline = parsedUpdate.deadline
          if (Object.keys(bulkData).length === 0) {
            autoUpdateSummary = 'Perubahan massal belum jelas. Sebutkan minimal status atau deadline yang mau diubah.'
          } else {
            const now = new Date()
            const whereBulk: Record<string, any> = { userId: session.user.id }
            applyTaskListModeToWhere(parsedUpdate.updateScope, now, whereBulk)
            const updatedMany = await db.task.updateMany({
              where: whereBulk,
              data: bulkData,
            })
            autoUpdateSummary = updatedMany.count
              ? `Siap, ${updatedMany.count} tugas berhasil diupdate.`
              : 'Tidak ada tugas yang cocok untuk diupdate massal.'
          }
        } else {
          let targetTask: { id: string; title: string } | null = null
          const userAskedByOrdinalOnly = !!parsedUpdate.targetOrdinal && !parsedUpdate.targetTitle
          if (!parsedUpdate.targetTitle && parsedUpdate.targetOrdinal && confirmedListContext?.ids?.length) {
            const targetId = confirmedListContext.ids[parsedUpdate.targetOrdinal - 1]
            if (targetId) {
              targetTask = await db.task.findFirst({
                where: { id: targetId, userId: session.user.id },
                select: { id: true, title: true },
              })
            }
          }
          if (!targetTask && parsedUpdate.targetOrdinal) {
            const allOrdered = await db.task.findMany({
              where: { userId: session.user.id },
              orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
              take: 100,
              select: { id: true, title: true },
            })
            const fallbackByOrdinal = allOrdered[parsedUpdate.targetOrdinal - 1]
            if (fallbackByOrdinal) {
              targetTask = fallbackByOrdinal
            }
          }
          if (!targetTask && parsedUpdate.targetTitle) {
            targetTask = await db.task.findFirst({
              where: {
                userId: session.user.id,
                title: { contains: parsedUpdate.targetTitle, mode: 'insensitive' },
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true, title: true },
            })
          }
          if (!targetTask && !userAskedByOrdinalOnly) {
            targetTask = await db.task.findFirst({
              where: { userId: session.user.id, status: { not: 'DONE' } },
              orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
              select: { id: true, title: true },
            })
          }

          if (!targetTask) {
            autoUpdateSummary = userAskedByOrdinalOnly
              ? 'Aku belum bisa mapping nomor tugasnya. Coba kirim `list tugas` dulu, lalu ulangi `edit tugas ke X ...`.'
              : 'Belum ada tugas yang bisa diupdate.'
          } else {
            const updateData: Record<string, any> = {}
            if (parsedUpdate.deadline) updateData.deadline = parsedUpdate.deadline
            if (parsedUpdate.status) updateData.status = parsedUpdate.status
            if (parsedUpdate.newTitle) updateData.title = parsedUpdate.newTitle

            if (Object.keys(updateData).length === 0) {
              autoUpdateSummary = 'Perubahan belum jelas. Sebutkan mau ubah tanggal/status/judulnya.'
            } else {
              const updated = await db.task.update({
                where: { id: targetTask.id },
                data: updateData,
                select: { title: true, deadline: true, status: true },
              })
              const updateBits: string[] = []
              if (parsedUpdate.newTitle) updateBits.push(`judul -> "${updated.title}"`)
              if (parsedUpdate.deadline) updateBits.push(`deadline -> ${updated.deadline?.toLocaleString('id-ID')}`)
              if (parsedUpdate.status) updateBits.push(`status -> ${updated.status}`)
              autoUpdateSummary = `Oke, tugas "${targetTask.title}" sudah diupdate: ${updateBits.join(', ')}.`
              autoPendingActionContext = serializePendingAction({ type: 'none' })
            }
          }
        }
      } catch {
        autoUpdateSummary = 'AI mencoba update tugas, tapi gagal karena gangguan server.'
      }
      }
    }

    if (shouldDeleteTask) {
      const parsedDelete = parseTaskDeleteIntent(userMessage)
      if (aiTaskDecision && aiDecisionConfident && aiTaskDecision.action === 'delete') {
        if (typeof aiTaskDecision.targetOrdinal === 'number' && aiTaskDecision.targetOrdinal > 0) {
          parsedDelete.ordinalNumbers = [aiTaskDecision.targetOrdinal]
        }
        if (aiTaskDecision.targetTitle && !parsedDelete.targetTitle) {
          parsedDelete.targetTitle = aiTaskDecision.targetTitle
        }
      }
      if (!isConfirmingPending) {
        const deleteScopeMode = lastListContext?.mode || 'all'
        const targetText = parsedDelete.targetTitle
          ? `"${parsedDelete.targetTitle}"`
          : parsedDelete.wantsAll
            ? deleteScopeMode === 'all'
              ? 'semua tugas'
              : `semua tugas di list ${formatTaskListModeLabel(deleteScopeMode)}`
          : parsedDelete.ordinalNumbers.length
            ? `nomor ${parsedDelete.ordinalNumbers.join(', ')}`
            : parsedDelete.wantsLatest
              ? 'tugas terakhir'
              : null
        if (!targetText) {
          autoDeleteSummary = 'Boleh, aku bantu hapus. Sebutkan judul atau nomor tugasnya dulu ya.'
        } else {
          autoDeleteSummary = `Konfirmasi dulu ya: hapus ${targetText}? Balas \`ya\` untuk lanjut.`
          autoPendingActionContext = serializePendingAction({ type: 'delete', data: parsedDelete, listContext: lastListContext })
        }
      } else if (pendingAction?.type !== 'delete') {
        autoDeleteSummary = 'Aksi yang menunggu konfirmasi bukan hapus. Kirim perintah hapus lagi kalau mau lanjut.'
      } else {
      try {
        const parsedDelete = pendingAction.data
        const confirmedListContext = pendingAction.listContext
        let postDeleteListMode: TaskListMode = lastListContext?.mode || 'all'
        if (parsedDelete.wantsAll) {
          const deleteScopeMode = confirmedListContext?.mode || lastListContext?.mode || 'all'
          const nowForDelete = new Date()
          const whereScope: Record<string, any> = { userId: session.user.id }
          applyTaskListModeToWhere(deleteScopeMode, nowForDelete, whereScope)

          let deleted: { count: number }
          const contextualIds = Array.isArray(confirmedListContext?.ids) ? confirmedListContext.ids.filter(Boolean) : []
          if (contextualIds.length) {
            const whereByContextualIds: Record<string, any> = {
              userId: session.user.id,
              id: { in: contextualIds },
            }
            if (deleteScopeMode !== 'all') {
              applyTaskListModeToWhere(deleteScopeMode, nowForDelete, whereByContextualIds)
            }
            deleted = await db.task.deleteMany({ where: whereByContextualIds })
            if (deleted.count === 0 && deleteScopeMode !== 'all') {
              const scoped = await db.task.findMany({
                where: whereScope,
                orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
                take: 200,
                select: { id: true },
              })
              const scopedIds = scoped.map((t) => t.id)
              deleted = scopedIds.length
                ? await db.task.deleteMany({ where: { userId: session.user.id, id: { in: scopedIds } } })
                : { count: 0 }
            }
          } else {
            deleted = await db.task.deleteMany({
              where: whereScope,
            })
          }
          autoDeleteSummary = deleted.count
            ? deleteScopeMode === 'all'
              ? `✅ Berhasil, semua tugas (${deleted.count}) sudah kehapus.`
              : `✅ Berhasil, semua tugas di list ${formatTaskListModeLabel(deleteScopeMode)} (${deleted.count}) sudah kehapus.`
            : 'Tidak ada tugas untuk dihapus.'
          autoPendingActionContext = serializePendingAction({ type: 'none' })
          postDeleteListMode = deleteScopeMode
        } else if (!parsedDelete.targetTitle && !parsedDelete.wantsLatest) {
          if (parsedDelete.ordinalNumbers.length > 0) {
            let indexed: Array<{ id: string; title: string }> = []
            if (confirmedListContext?.ids?.length) {
              const byIds = await db.task.findMany({
                where: { userId: session.user.id, id: { in: confirmedListContext.ids } },
                select: { id: true, title: true },
              })
              const mapById = new Map(byIds.map((t) => [t.id, t]))
              indexed = confirmedListContext.ids.map((id) => mapById.get(id)).filter(Boolean) as Array<{ id: string; title: string }>
              postDeleteListMode = confirmedListContext.mode
            }
            if (!indexed.length) {
              let recentListMode: TaskListMode = 'all'
              const userMessages = contextMessagePool
                .filter((m: any) => m?.role === 'user' && typeof m?.content === 'string')
                .map((m: any) => String(m.content))
              for (let i = userMessages.length - 1; i >= 0; i -= 1) {
                if (looksLikeTaskListIntent(userMessages[i])) {
                  recentListMode = parseTaskListIntent(userMessages[i])
                  break
                }
              }
              postDeleteListMode = recentListMode
              const now = new Date()
              const whereByMode: Record<string, any> = { userId: session.user.id }
              applyTaskListModeToWhere(recentListMode, now, whereByMode)
              indexed = await db.task.findMany({
                where: whereByMode,
                orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
                take: 50,
                select: { id: true, title: true },
              })
            }

            const picked = parsedDelete.ordinalNumbers
              .map((n) => ({ n, task: indexed[n - 1] || null }))
              .filter((entry) => !!entry.task) as Array<{ n: number; task: { id: string; title: string } }>
            const missing = parsedDelete.ordinalNumbers.filter((n) => !indexed[n - 1])
            if (!picked.length) {
              autoDeleteSummary = `Aku nggak nemu item nomor ${parsedDelete.ordinalNumbers.join(', ')} dari list terakhir.`
            } else {
              await db.task.deleteMany({ where: { id: { in: picked.map((p) => p.task.id) }, userId: session.user.id } })
              const removed = picked.map((p) => `#${p.n} "${p.task.title}"`).join(', ')
              autoDeleteSummary = `Berhasil aku hapus ${removed}.`
              if (missing.length) {
                autoDeleteSummary += ` Nomor ${missing.join(', ')} nggak ada di list terakhir.`
              }
            }
          } else {
            autoDeleteSummary =
              'Boleh, aku bantu hapus. Sebutkan judul tugasnya ya (atau bilang "hapus tugas ke 3", "hapus tugas ke 5-6", atau "hapus tugas terakhir").'
          }
        } else {
          let targetTask: { id: string; title: string } | null = null
          if (parsedDelete.wantsLatest && !parsedDelete.targetTitle) {
            postDeleteListMode = 'all'
            targetTask = await db.task.findFirst({
              where: { userId: session.user.id },
              orderBy: { createdAt: 'desc' },
              select: { id: true, title: true },
            })
          } else if (parsedDelete.targetTitle) {
            postDeleteListMode = 'all'
            const candidates = await db.task.findMany({
              where: {
                userId: session.user.id,
                title: { contains: parsedDelete.targetTitle, mode: 'insensitive' },
              },
              orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
              take: 5,
              select: { id: true, title: true, deadline: true },
            })
            if (!candidates.length) {
              autoDeleteSummary = `Aku belum nemu tugas dengan judul mirip "${parsedDelete.targetTitle}".`
            } else if (candidates.length > 1) {
              const options = candidates
                .map((t, i) => `${i + 1}. ${t.title}${t.deadline ? ` (${new Date(t.deadline).toLocaleDateString('id-ID')})` : ''}`)
                .join('\n')
              autoDeleteSummary =
                `Aku nemu beberapa tugas yang mirip. Kasih judul yang lebih spesifik ya:\n${options}`
            } else {
              targetTask = { id: candidates[0].id, title: candidates[0].title }
            }
          }
          if (targetTask) {
            await db.task.delete({ where: { id: targetTask.id } })
            autoDeleteSummary = `Berhasil, tugas "${targetTask.title}" udah kehapus.`
            autoPendingActionContext = serializePendingAction({ type: 'none' })
          } else if (!autoDeleteSummary) {
            autoDeleteSummary = 'Belum ada tugas yang bisa dihapus.'
          }
        }

        if (/berhasil|udah kehapus|aku hapus/i.test(autoDeleteSummary)) {
          const now = new Date()
          const whereAfterDelete: Record<string, any> = { userId: session.user.id }
          applyTaskListModeToWhere(postDeleteListMode, now, whereAfterDelete)
          const refreshed = await db.task.findMany({
            where: whereAfterDelete,
            orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
            take: 10,
            select: { id: true, title: true, subject: true, status: true, deadline: true, priority: true },
          })
          if (!refreshed.length) {
            autoDeleteSummary += [
              '',
              '',
              'List terbaru:',
              '',
              '| No | Judul | Mapel | Status | Prioritas | Deadline |',
              '|---:|---|---|---|---|---|',
            ].join('\n')
            autoListContext = serializeTaskListContext({
              mode: postDeleteListMode,
              ids: [],
              generatedAt: new Date().toISOString(),
            })
          } else {
            const refreshedLines = refreshed.map((t, i) => {
              const dl = t.deadline ? new Date(t.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'tanpa deadline'
              const sub = t.subject || '-'
              return `| ${i + 1} | ${t.title.replace(/\|/g, '\\|')} | ${sub.replace(/\|/g, '\\|')} | ${t.status} | ${t.priority} | ${dl} |`
            })
            autoDeleteSummary += [
              '',
              'List terbaru:',
              '',
              '| No | Judul | Mapel | Status | Prioritas | Deadline |',
              '|---:|---|---|---|---|---|',
              ...refreshedLines,
            ].join('\n')
            autoListContext = serializeTaskListContext({
              mode: postDeleteListMode,
              ids: refreshed.map((t) => t.id),
              generatedAt: new Date().toISOString(),
            })
          }
        }
      } catch {
        autoDeleteSummary = 'AI mencoba hapus tugas, tapi gagal karena gangguan server.'
      }
      }
    }

    if (shouldListTask) {
      const aiListMode = aiTaskDecision && aiDecisionConfident && aiTaskDecision.action === 'list'
        ? aiTaskDecision.listMode
        : null
      const listMode = aiListMode || parseTaskListIntent(userMessage)
      try {
        const now = new Date()
        const whereBase: Record<string, any> = { userId: session.user.id }
        applyTaskListModeToWhere(listMode, now, whereBase)
        const list = await db.task.findMany({
          where: whereBase,
          orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
          take: 10,
          select: { id: true, title: true, subject: true, status: true, deadline: true, priority: true },
        })
        if (!list.length) {
          autoListSummary = [
            `Daftar tugas (${listMode}):`,
            '',
            '| No | Judul | Mapel | Status | Prioritas | Deadline |',
            '|---:|---|---|---|---|---|',
          ].join('\n')
          autoListContext = serializeTaskListContext({
            mode: listMode,
            ids: [],
            generatedAt: new Date().toISOString(),
          })
        } else {
          const lines = list.map((t, i) => {
            const dl = t.deadline ? new Date(t.deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'tanpa deadline'
            const sub = t.subject || '-'
            return `| ${i + 1} | ${t.title.replace(/\|/g, '\\|')} | ${sub.replace(/\|/g, '\\|')} | ${t.status} | ${t.priority} | ${dl} |`
          })
          autoListSummary = [
            `Daftar tugas (${listMode}):`,
            '',
            '| No | Judul | Mapel | Status | Prioritas | Deadline |',
            '|---:|---|---|---|---|---|',
            ...lines,
          ].join('\n')
          autoListContext = serializeTaskListContext({
            mode: listMode,
            ids: list.map((t) => t.id),
            generatedAt: new Date().toISOString(),
          })
        }
      } catch {
        autoListSummary = 'AI mencoba ambil daftar tugas, tapi gagal karena gangguan server.'
      }
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
    const commandSummaries = [autoScheduleSummary, autoUpdateSummary, autoDeleteSummary, autoListSummary].filter(Boolean)
    if (isTaskCommandIntent && commandSummaries.length > 0) {
      const directReply = stripInternalContext(commandSummaries.join('\n\n'))
      history.push({ role: 'user', content: userMessage || 'Perintah tugas' })
      history.push({ role: 'assistant', content: directReply })
      if (autoListContext) {
        history.push({ role: 'assistant', content: autoListContext })
      }
      if (autoPendingActionContext) {
        history.push({ role: 'assistant', content: autoPendingActionContext })
      }
      try {
        if (aiSession) {
          await db.aISession.update({
            where: { id: aiSession.id },
            data: { messages: history },
          })
        } else {
          aiSession = await db.aISession.create({
            data: {
              title: (userMessage || 'Perintah tugas').slice(0, 50),
              messages: history,
              userId: session.user.id,
            },
          })
        }
      } catch {
      }
      return NextResponse.json({
        reply: directReply,
        sessionId: aiSession?.id ?? null,
      })
    }

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
          `\nGunakan data ini saat user minta jadwal/tugas/deadline.${
            autoScheduleSummary ? `\nStatus automasi jadwal: ${autoScheduleSummary}` : ''
          }`
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

    const visibleHistory = trimmedHistory.filter(
      (m) => !(m?.role === 'assistant' && typeof m?.content === 'string' && m.content.startsWith(TASK_LIST_CONTEXT_PREFIX)),
    )
    const contextMessages = hasImage
      ? visibleHistory
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }))
      : visibleHistory.map((m) => ({ role: m.role, content: m.content }))

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
    if (autoScheduleSummary) {
      reply = `📅 ${autoScheduleSummary}\n\n${reply}`
    }
    if (autoUpdateSummary) {
      reply = `🛠️ ${autoUpdateSummary}\n\n${reply}`
    }
    if (autoDeleteSummary) {
      reply = `🗑️ ${autoDeleteSummary}\n\n${reply}`
    }
    if (autoListSummary) {
      reply = `📋 ${autoListSummary}\n\n${reply}`
    }
    reply = stripInternalContext(reply)

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