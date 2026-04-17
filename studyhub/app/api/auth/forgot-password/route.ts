import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendResetPasswordEmail } from '@/lib/mail'
import { checkRateLimit, getIP, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, RATE_LIMITS.forgotPassword)
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const { email } = await req.json()

  const user = await db.user.findUnique({ where: { email } })

  if (!user) {
    return NextResponse.json({ message: 'Email tidak ditemukan' }, { status: 404 })
  }

  const token = crypto.randomBytes(32).toString('hex')

  await db.user.update({
    where: { email },
    data: {
      resetToken: token,
      resetTokenExpiry: new Date(Date.now() + 1000 * 60 * 15),
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const link = `${baseUrl}/auth/reset-password?token=${token}`

  try {
    const result = await sendResetPasswordEmail(email, link)
    return NextResponse.json({ message: 'Link reset dikirim', messageId: (result as any)?.messageId })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Gagal mengirim email reset password.' },
      { status: 500 },
    )
  }
}