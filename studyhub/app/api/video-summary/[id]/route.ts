import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { callAI } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── GET: detail video summary ─────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await db.videoSummary.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, title: true, sourceUrl: true, sourceType: true, duration: true, summary: true, status: true, createdAt: true },
  })

  if (!video) return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 })
  return NextResponse.json(video)
}

// ── DELETE: hapus video summary ───────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await db.videoSummary.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!video) return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 })

  // Hard delete untuk video (lifetime counter tetap di User.videoUploadCount)
  await db.videoSummary.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

// ── POST /api/video-summary/[id]/reprocess: proses ulang jika error/timeout ──
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const video = await db.videoSummary.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, transcript: true, title: true, duration: true, status: true },
  })
  if (!video) return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 })
  if (!video.transcript) return NextResponse.json({ error: 'Transkrip tidak tersedia.' }, { status: 400 })

  await db.videoSummary.update({ where: { id: params.id }, data: { status: 'PROCESSING' } })

  try {
    const summary = await callAI([
      { role: 'system', content: 'Kamu adalah asisten akademik ahli yang membuat ringkasan komprehensif dari video. Gunakan format markdown yang rapi.' },
      {
        role: 'user',
        content: `Buat ringkasan komprehensif dari transkrip video "${video.title}" dalam Bahasa Indonesia.\n\nFormat:\n## 🎬 Tentang Video\n[1-2 paragraf]\n\n## 📌 Poin Utama\n[8-12 poin]\n\n## 💡 Insight Penting\n[3-5 insight]\n\n## ✅ Kesimpulan\n[2-3 kalimat]\n\nTRANSKRIP:\n${video.transcript.slice(0, 40000)}`,
      },
    ], 2000, 50_000)

    await db.videoSummary.update({ where: { id: params.id }, data: { summary, status: 'READY' } })
    return NextResponse.json({ summary, status: 'READY' })
  } catch {
    await db.videoSummary.update({ where: { id: params.id }, data: { status: 'ERROR' } })
    return NextResponse.json({ error: 'Gagal membuat ringkasan. Coba lagi.' }, { status: 500 })
  }
}
