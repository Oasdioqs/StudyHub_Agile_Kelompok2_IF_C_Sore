import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI } from '@/lib/openrouter'
import { isDevPremium } from '@/lib/dev-premium'

export const runtime = 'nodejs'
export const maxDuration = 60

const FREE_VIDEO_LIMIT = 3
const CHUNK_SIZE = 8000
const MAX_PARALLEL = 4

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

/** Parse WebVTT (Teams auto-transcript) */
function parseVtt(text: string): string {
  return text
    .replace(/WEBVTT[\s\S]*?\n\n/, '')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}[^\n]*/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Parse SRT subtitle */
function parseSrt(text: string): string {
  return text
    .replace(/^\d+\s*$/gm, '')
    .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Fetch YouTube transcript with language fallback */
async function fetchYouTubeTranscript(videoId: string): Promise<{ text: string; duration: number }> {
  const { YoutubeTranscript } = await import('youtube-transcript')

  // Coba beberapa bahasa secara berurutan
  const langs = ['id', 'en', 'en-US', 'en-GB']
  let lastError: unknown
  for (const lang of langs) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang })
      if (items && items.length > 0) {
        const text = items.map((t: any) => t.text?.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')).join(' ')
        const last = items[items.length - 1] as any
        const duration = last ? Math.round((last.offset ?? 0) / 1000 + (last.duration ?? 0)) : 0
        return { text, duration }
      }
    } catch (err) {
      lastError = err
    }
  }

  // Fallback: coba tanpa lang parameter
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId)
    if (items && items.length > 0) {
      const text = items.map((t: any) => t.text?.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')).join(' ')
      const last = items[items.length - 1] as any
      const duration = last ? Math.round((last.offset ?? 0) / 1000 + (last.duration ?? 0)) : 0
      return { text, duration }
    }
  } catch (err) {
    lastError = err
  }

  const errMsg = (lastError as any)?.message ?? ''
  if (errMsg.includes('disabled') || errMsg.includes('No transcripts') || errMsg.includes('Could not get')) {
    throw new Error('NO_TRANSCRIPT')
  }
  throw new Error('YOUTUBE_FETCH_FAILED')
}

async function summarizeChunk(chunk: string, chunkIndex: number, totalChunks: number): Promise<string> {
  const position = chunkIndex === 0 ? 'awal' : chunkIndex === totalChunks - 1 ? 'akhir' : `bagian ke-${chunkIndex + 1}`
  return callAI([
    { role: 'system', content: 'Kamu adalah asisten akademik yang merangkum konten video/meeting. Buat ringkasan padat dalam Bahasa Indonesia.' },
    { role: 'user', content: `Ringkas poin-poin penting dari transkrip ${position} (bagian ${chunkIndex + 1}/${totalChunks}) berikut dalam 5-8 poin singkat:\n\n${chunk}` },
  ], 800, 25_000)
}

async function buildFinalSummary(chunkSummaries: string[], title: string, duration: number, sourceLabel: string): Promise<string> {
  const durationText = duration > 0 ? `(durasi: ${Math.floor(duration / 60)} mnt ${duration % 60} dtk)` : ''
  const combined = chunkSummaries.length === 1
    ? chunkSummaries[0]
    : chunkSummaries.map((s, i) => `--- Bagian ${i + 1} ---\n${s}`).join('\n\n')

  return callAI([
    { role: 'system', content: 'Kamu adalah asisten akademik ahli yang membuat ringkasan komprehensif. Gunakan format markdown yang rapi dalam Bahasa Indonesia.' },
    {
      role: 'user',
      content: `Buat ringkasan KOMPREHENSIF dari ${sourceLabel} "${title}" ${durationText}.\n\n${chunkSummaries.length > 1 ? `RINGKASAN TIAP BAGIAN:\n${combined}` : `TRANSKRIP:\n${combined}`}\n\nFormat output:\n## 🎬 Tentang Konten\n[1-2 paragraf]\n\n## 📌 Poin Utama\n[8-15 poin berurutan]\n\n## 💡 Insight Penting\n[3-5 insight atau hal paling berharga]\n\n## ✅ Kesimpulan\n[2-3 kalimat penutup]`,
    },
  ], 2000, 50_000)
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [videos, user] = await Promise.all([
      db.videoSummary.findMany({
        where: { userId: session.user.id },
        select: { id: true, title: true, sourceUrl: true, sourceType: true, duration: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findUnique({
        where: { id: session.user.id },
        select: { isPremium: true, videoUploadCount: true, email: true },
      }),
    ])
    const isPremium = (user?.isPremium ?? false) || isDevPremium(user?.email)
    const isDeveloper = isDevPremium(user?.email)
    const lifetimeUsed = user?.videoUploadCount ?? 0
    return NextResponse.json({ videos, isPremium, isDeveloper, limit: FREE_VIDEO_LIMIT, lifetimeUsed })
  } catch {
    return NextResponse.json({ videos: [], isPremium: false, isDeveloper: false, limit: FREE_VIDEO_LIMIT, lifetimeUsed: 0 })
  }
}

// ── POST: submit YouTube URL atau transkrip ───────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // Cek limit lifetime
  const user = await db.user.findUnique({ where: { id: userId }, select: { isPremium: true, videoUploadCount: true, email: true } })
  const premiumActive = user?.isPremium || isDevPremium(user?.email)
  if (!premiumActive) {
    const lifetimeCount = user?.videoUploadCount ?? 0
    if (lifetimeCount >= FREE_VIDEO_LIMIT) {
      return NextResponse.json({
        error: `Batas ${FREE_VIDEO_LIMIT} video (seumur hidup) tercapai. Upgrade ke Premium.`,
        limitReached: true,
      }, { status: 403 })
    }
  }

  // Dua mode: JSON body (youtube/text) atau multipart (file upload)
  const contentType = req.headers.get('content-type') ?? ''
  let sourceType = 'youtube'
  let sourceUrl = ''
  let customTitle = ''
  let rawTranscript: string | null = null
  let uploadedFileName = ''
  let liveDuration = 0

  if (contentType.includes('multipart/form-data')) {
    // File upload (VTT / SRT / TXT dari Teams/SharePoint)
    let form: FormData
    try { form = await req.formData() } catch {
      return NextResponse.json({ error: 'Format form tidak valid.' }, { status: 400 })
    }
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['vtt', 'srt', 'txt'].includes(ext)) {
      return NextResponse.json({ error: 'Format file tidak didukung. Gunakan .vtt, .srt, atau .txt' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5 MB.' }, { status: 400 })
    }

    const raw = await file.text()
    rawTranscript = ext === 'vtt' ? parseVtt(raw) : ext === 'srt' ? parseSrt(raw) : raw.trim()
    if (!rawTranscript || rawTranscript.length < 50) {
      return NextResponse.json({ error: 'Transkrip terlalu singkat atau kosong.' }, { status: 400 })
    }

    customTitle = (form.get('title') as string | null)?.trim() || file.name.replace(/\.(vtt|srt|txt)$/i, '')
    uploadedFileName = file.name
    sourceType = 'teams'
    sourceUrl = `file:${uploadedFileName}`
  } else {
    // JSON body: YouTube URL atau paste teks
    const body = await req.json().catch(() => ({}))
    customTitle = (body.title ?? '').trim()
    sourceType = body.sourceType ?? 'youtube'

    if (sourceType === 'text' || sourceType === 'live') {
      rawTranscript = (body.transcript ?? '').trim()
      if (!rawTranscript || rawTranscript.length < 20) {
        return NextResponse.json({ error: 'Transkrip terlalu singkat.' }, { status: 400 })
      }
      if (body.duration && typeof body.duration === 'number' && body.duration > 0) {
        liveDuration = Math.round(body.duration)
      }
      sourceUrl = sourceType === 'live' ? 'live:browser' : 'text:paste'
    } else {
      // YouTube URL
      const url = (body.url ?? '').trim()
      if (!url) return NextResponse.json({ error: 'URL video tidak boleh kosong.' }, { status: 400 })
      const videoId = extractYouTubeId(url)
      if (!videoId) return NextResponse.json({ error: 'URL YouTube tidak valid.' }, { status: 400 })
      sourceUrl = url
      sourceType = 'youtube'
    }
  }

  // Buat record + increment lifetime counter
  const [record] = await db.$transaction([
    db.videoSummary.create({
      data: {
        userId,
        title: customTitle || (
          sourceType === 'youtube' ? 'Video YouTube'
          : sourceType === 'teams' ? `Meeting: ${uploadedFileName}`
          : sourceType === 'live' ? `Live Meeting ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}`
          : 'Transkrip Tempel'
        ),
        sourceUrl,
        sourceType,
        status: 'PROCESSING',
        ...(liveDuration > 0 ? { duration: liveDuration } : {}),
      },
    }),
    db.user.update({ where: { id: userId }, data: { videoUploadCount: { increment: 1 } } }),
  ])

  // Proses async
  const processVideo = async () => {
    try {
      let transcript = rawTranscript ?? ''
      let duration = 0

      // YouTube: fetch transcript dari YouTube
      if (sourceType === 'youtube') {
        const videoId = extractYouTubeId(sourceUrl)!
        const result = await fetchYouTubeTranscript(videoId)
        transcript = result.text
        duration = result.duration
        await db.videoSummary.update({ where: { id: record.id }, data: { transcript, duration } })
      } else if (transcript) {
        await db.videoSummary.update({ where: { id: record.id }, data: { transcript } })
      }

      if (!transcript || transcript.length < 30) {
        throw new Error('NO_TRANSCRIPT')
      }

      const sourceLabel = sourceType === 'youtube' ? 'video YouTube'
        : sourceType === 'teams' ? 'rekaman meeting Teams/SharePoint'
        : sourceType === 'live' ? 'rekaman live meeting'
        : 'transkrip'

      let summary: string
      if (transcript.length <= CHUNK_SIZE) {
        summary = await buildFinalSummary([transcript], record.title, duration, sourceLabel)
      } else {
        const chunks: string[] = []
        for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
          chunks.push(transcript.slice(i, i + CHUNK_SIZE))
        }
        const chunkSummaries: string[] = []
        for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
          const batch = chunks.slice(i, i + MAX_PARALLEL)
          const results = await Promise.all(batch.map((c, j) => summarizeChunk(c, i + j, chunks.length).catch(() => '')))
          chunkSummaries.push(...results.filter(Boolean))
        }
        summary = await buildFinalSummary(chunkSummaries, record.title, duration, sourceLabel)
      }

      await db.videoSummary.update({ where: { id: record.id }, data: { summary, status: 'READY' } })
    } catch (err: any) {
      const isNoTranscript = err?.message === 'NO_TRANSCRIPT'
      const isFetchFail = err?.message === 'YOUTUBE_FETCH_FAILED'
      await db.videoSummary.update({
        where: { id: record.id },
        data: {
          status: 'ERROR',
          summary: isNoTranscript
            ? 'Video ini tidak memiliki subtitle/transkrip yang dapat diakses. Coba download transkrip dari YouTube/Teams lalu upload file .vtt atau .txt.'
            : isFetchFail
              ? 'Gagal mengambil transkrip dari YouTube. Kemungkinan video private, caption dinonaktifkan, atau server sedang sibuk. Coba lagi atau upload transkrip manual.'
              : `Gagal memproses: ${err?.message ?? 'Unknown error'}. Coba proses ulang.`,
        },
      }).catch(() => {})
    }
  }

  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 55_000))
  Promise.race([processVideo(), timeout]).catch(async () => {
    await db.videoSummary.update({
      where: { id: record.id },
      data: { status: 'READY', summary: 'Ringkasan sedang diproses di latar belakang. Tunggu sebentar lalu refresh.' },
    }).catch(() => {})
  })

  return NextResponse.json({ id: record.id, status: 'PROCESSING' })
}
