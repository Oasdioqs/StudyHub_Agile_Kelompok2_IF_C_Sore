import { NextResponse } from 'next/server'
import { ensureRemindersForAllUsers } from '@/lib/reminders'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const q = new URL(req.url).searchParams.get('secret')
  if (token !== secret && q !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureRemindersForAllUsers()
  return NextResponse.json({ ok: true })
}
