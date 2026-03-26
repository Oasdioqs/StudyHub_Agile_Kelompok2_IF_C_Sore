import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'

const OTP_COOKIE_NAME = 'otp_verified_for'
const EMAIL_VERIFIED_COOKIE_NAME = 'email_verified_for'

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, code } = body as { email?: string; code?: string }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: 'Kode OTP tidak valid.' }, { status: 400 })
  }

  let userId: string | null = null
  if (email) {
    const user = await db.user.findUnique({ where: { email } })
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

  const expectedHash = sha256(code)
  const matchedOtp = activeOtps.find((item) => item.codeHash === expectedHash)
  if (!matchedOtp) {
    return NextResponse.json({ message: 'Kode OTP salah.' }, { status: 400 })
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

  cookies().set(OTP_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  })

  cookies().set(EMAIL_VERIFIED_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  })

  return NextResponse.json({ message: 'OTP verified.' })
}

