import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import {
  checkRateLimit,
  checkFailedOtp,
  recordFailedOtp,
  clearFailedOtp,
  getIP,
  RATE_LIMITS,
  rateLimitResponse,
} from '@/lib/rate-limit'
import { sanitizeEmail } from '@/lib/sanitize'

const OTP_COOKIE_NAME = 'otp_verified_for'
const EMAIL_VERIFIED_COOKIE_NAME = 'email_verified_for'

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req)
    const body = await req.json().catch(() => ({}))
    const { email, code } = body as { email?: string; code?: string }
    const normalizedEmail = sanitizeEmail(email || '')

    // Check general rate limit per IP
    const rl = checkRateLimit(ip, RATE_LIMITS.otpVerify)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    // Check for blocked email (too many failed attempts)
    if (normalizedEmail) {
      const blocked = checkFailedOtp(normalizedEmail)
      if (blocked.blocked) {
        const retryAfterSec = Math.ceil((blocked.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { message: 'Terlalu banyak percobaan salah. Coba lagi beberapa menit.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(retryAfterSec, 60)),
              'X-RateLimit-Reset': String(Math.ceil(blocked.resetAt / 1000)),
            },
          },
        )
      }
    }

    // Validate and normalize OTP code - strip spaces and non-digits
    const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6)
    if (normalizedCode.length !== 6) {
      return NextResponse.json({ message: 'Kode OTP harus 6 digit.' }, { status: 400 })
    }

    let userId: string | null = null
    if (normalizedEmail) {
      const user = await db.user.findUnique({ where: { email: normalizedEmail } })
      if (!user) {
        return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 })
      }
      userId = user.id
    } else {
      const session = await getServerSession(authOptions).catch(() => null)
      if (session?.user?.id) {
        userId = session.user.id
      } else {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
      }
    }

    const activeOtps = await db.loginOtp.findMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSentAt: 'desc' },
      take: 5,
    })

    if (!activeOtps.length) {
      return NextResponse.json({ message: 'OTP tidak valid atau sudah expired.' }, { status: 400 })
    }

    const expectedHash = sha256(normalizedCode)
    const matchedOtp = activeOtps.find((item) => item.codeHash === expectedHash)

    if (!matchedOtp) {
      // Record failed attempt
      if (normalizedEmail) {
        recordFailedOtp(normalizedEmail)
      }
      return NextResponse.json({ message: 'Kode OTP salah.' }, { status: 400 })
    }

    // Clear failed attempts on success
    if (normalizedEmail) {
      clearFailedOtp(normalizedEmail)
    }

    await db.loginOtp.update({
      where: { id: matchedOtp.id },
      data: { usedAt: new Date() },
    })

    await db.loginOtp.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user?.emailVerified) {
      return NextResponse.json({ message: 'Email kamu belum terverifikasi.' }, { status: 403 })
    }

    const isProd = process.env.NODE_ENV === 'production'
    const cookieStore = await cookies()
    cookieStore.set(OTP_COOKIE_NAME, userId, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 60 * 30,
      path: '/',
    })

    cookieStore.set(EMAIL_VERIFIED_COOKIE_NAME, userId, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 60 * 30,
      path: '/',
    })

    return NextResponse.json({ message: 'OTP verified.' })
  } catch (error) {
    console.error('OTP Verification Error:', error)
    return NextResponse.json(
      { message: 'Terjadi kesalahan server. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}

