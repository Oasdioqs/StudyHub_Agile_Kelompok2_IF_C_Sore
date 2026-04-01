import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Secret key untuk proteksi endpoint ini
// Tambahkan ADMIN_SECRET ke environment variables Vercel
const ADMIN_SECRET = process.env.ADMIN_SECRET

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { email, isPremium = true } = body

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const user = await db.user.update({
    where: { email },
    data: { isPremium },
    select: { id: true, name: true, email: true, isPremium: true },
  }).catch(() => null)

  if (!user) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })

  return NextResponse.json({ ok: true, user })
}
