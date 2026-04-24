import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

const OTP_COOKIE_NAME = 'otp_verified_for'
const EMAIL_VERIFIED_COOKIE_NAME = 'email_verified_for'

// In-memory store for failed attempts (per email)
// This is for serverless - works because each cold start is fresh
// For better persistence, consider using Redis or database
const failedAttempts = new Map<string, { count: number; resetAt: number }>()

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// Progressive delay for failed attempts (anti-brute force)
function getDelayForEmail(email: string): number {
  const key = email.toLowerCase()
  const entry = failedAttempts.get(key)
  const now = Date.now()

  if (!entry || now > entry.resetAt) {
    return 0
  }

  // Progressive delay: 1s, 2s, 4s, 8s, 16s for 1st-5th failed attempt
  const delay = Math.min(Math.pow(2, entry.count - 1) * 1000, 16000)
  return delay
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const entry = failedAttempts.get(key)

  if (!entry || now > entry.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
  } else {
    entry.count++
    // Reset after 15 minutes of no attempts
    entry.resetAt = now + 15 * 60 * 1000
    failedAttempts.set(key, entry)
  }
}

function clearFailedAttempts(email: string): void {
  const key = email.toLowerCase()
  failedAttempts.delete(key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, code } = body as { email?: string; code?: string }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    // Check if blocked by too many failed attempts
    if (normalizedEmail) {
      const entry = failedAttempts.get(normalizedEmail.toLowerCase())
      if (entry && entry.count >= 5 && Date.now() < entry.resetAt) {
        const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { message: `Terlalu banyak percobaan salah. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.` },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.max(retryAfter, 60)) },
          },
        )
      }

      // Apply progressive delay for failed attempts
      const delay = getDelayForEmail(normalizedEmail)
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Validate and normalize OTP code
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
        recordFailedAttempt(normalizedEmail)
      }
      return NextResponse.json({ message: 'Kode OTP salah.' }, { status: 400 })
    }

    // Clear failed attempts on success
    if (normalizedEmail) {
      clearFailedAttempts(normalizedEmail)
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
    const { cookies: cookieStore } = await import('next/headers')
    cookieStore().set(OTP_COOKIE_NAME, userId!, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      maxAge: 60 * 30,
      path: '/',
    })

    cookieStore().set(EMAIL_VERIFIED_COOKIE_NAME, userId!, {
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

