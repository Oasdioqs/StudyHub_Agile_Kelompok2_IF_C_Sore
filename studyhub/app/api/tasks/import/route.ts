import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type ParsedTask = {
  title: string
  deadline: Date | null
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  subject: string | null
}

function parseDate(text: string): Date | null {
  const now = new Date()
  const lower = text.toLowerCase()
  let d: Date | null = null

  const ymd = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  const dmy = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
  const time = lower.match(/\b(?:jam\s*)?(\d{1,2})[:.](\d{2})\b/)

  if (ymd) {
    d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 20, 0, 0, 0)
  } else if (dmy) {
    const yearRaw = dmy[3] ? Number(dmy[3]) : now.getFullYear()
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 20, 0, 0, 0)
  } else if (/lusa/.test(lower)) {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 20, 0, 0, 0)
  } else if (/besok/.test(lower)) {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 20, 0, 0, 0)
  } else if (/hari ini|today/.test(lower)) {
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0)
  }

  if (!d || Number.isNaN(d.getTime())) return null
  if (time) d.setHours(Number(time[1]), Number(time[2]), 0, 0)
  return d
}

function inferPriority(text: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const lower = text.toLowerCase()
  if (/urgent|penting|asap|segera|must/.test(lower)) return 'HIGH'
  if (/santai|nanti aja|low/.test(lower)) return 'LOW'
  return 'MEDIUM'
}

function inferSubject(text: string): string | null {
  const m = text.match(/(?:mapel|mata pelajaran|subject|kelas)\s*[:\-]?\s*([a-zA-Z0-9 ]{2,40})/i)
  return m?.[1]?.trim() || null
}

function cleanTitle(text: string): string {
  return text
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, ' ')
    .replace(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/g, ' ')
    .replace(/\b(?:jam\s*)?(\d{1,2})[:.](\d{2})\b/gi, ' ')
    .replace(/\b(hari ini|besok|lusa|today|deadline|due|tanggal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBulkText(raw: string) {
  const lines = raw
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)

  const parsed: ParsedTask[] = []
  const skipped: string[] = []

  for (const line of lines) {
    if (line.length < 4) continue
    const deadline = parseDate(line)
    const title = cleanTitle(line)
    if (!title || title.length < 3) {
      skipped.push(line)
      continue
    }
    parsed.push({
      title,
      deadline,
      priority: inferPriority(line),
      subject: inferSubject(line),
    })
  }

  return { parsed, skipped }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = String(body?.text || '').trim()
  if (!text) return NextResponse.json({ error: 'Teks kosong.' }, { status: 400 })

  const { parsed, skipped } = parseBulkText(text)
  if (!parsed.length) {
    return NextResponse.json({ error: 'Tidak ada task valid yang terbaca.', skipped }, { status: 400 })
  }

  const created = []
  for (const item of parsed.slice(0, 80)) {
    const task = await db.task.create({
      data: {
        title: item.title,
        deadline: item.deadline,
        priority: item.priority,
        subject: item.subject,
        userId: session.user.id,
      },
      select: { id: true, title: true, deadline: true },
    })
    created.push(task)
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    skipped: skipped.length,
    skippedSamples: skipped.slice(0, 5),
  })
}
