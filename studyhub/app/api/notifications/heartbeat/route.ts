import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST: heartbeat — trigger reminder checks untuk user saat ini
// Dipanggil setiap 5 menit oleh client
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  // Emergency mode: disable heartbeat workload to prioritize auth/OTP stability.
  return NextResponse.json({ ok: true, skipped: true })
}
