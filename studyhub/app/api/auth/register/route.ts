import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { resendVerificationEmail, sendWelcomeEmail } from '@/lib/mail'
import { checkRateLimit, getIP, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, RATE_LIMITS.register)
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const body = await req.json().catch(() => ({}))
  const name = String((body as any).name || '').trim()
  const email = String((body as any).email || '').trim().toLowerCase()
  const password = String((body as any).password || '')
  const refCode = String((body as any).ref || '').trim().toUpperCase() || null

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Semua field wajib diisi' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'Email sudah digunakan' }, { status: 409 })
  }

  // Cari referrer jika ada kode referral
  let referrerId: string | null = null
  if (refCode) {
    const referrer = await db.user.findUnique({
      where: { referralCode: refCode },
      select: { id: true },
    }).catch(() => null)
    referrerId = referrer?.id ?? null
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashed,
      referredBy: referrerId,
    },
    select: { id: true, name: true, email: true },
  })

  // Reward referrer: +50 poin, increment referralCount
  if (referrerId) {
    await db.user.update({
      where: { id: referrerId },
      data: {
        points: { increment: 50 },
        referralCount: { increment: 1 },
      },
    }).catch(() => null)
  }

  // Kirim welcome email (fire and forget, tidak blok response)
  sendWelcomeEmail(user.email, user.name).catch(() => null)

  const sendResult = await resendVerificationEmail(user.email)
  if ((sendResult as any)?.error) {
    return NextResponse.json(
      {
        ...user,
        warning:
          (sendResult as any).error.message ||
          'Akun berhasil dibuat, tapi email verifikasi belum berhasil dikirim. Coba kirim ulang dari halaman login.',
      },
      { status: 201 },
    )
  }

  return NextResponse.json(user, { status: 201 })
}
