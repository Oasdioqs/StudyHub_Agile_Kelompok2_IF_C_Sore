import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'

const EMAIL_VERIFIED_COOKIE = 'email_verified_for'

async function verifyToken(token: string) {
  if (!token) return null

  const verification = await db.verificationToken.findUnique({
    where: { token },
  })

  if (!verification) return null
  if (verification.expires.getTime() < Date.now()) return null

  const user = await db.user.findUnique({
    where: { email: verification.identifier },
  })

  if (!user) return null

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  })

  await db.verificationToken.delete({
    where: { token },
  })

  return { userId: user.id }
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  const result = await verifyToken(token)

  if (!result) {
    return NextResponse.json({ message: 'Token verifikasi tidak valid atau sudah expired.' }, { status: 400 })
  }

  cookies().set(EMAIL_VERIFIED_COOKIE, result.userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  })

  return NextResponse.json({ message: 'Email terverifikasi.' })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || ''

  const result = await verifyToken(token)

  if (!result) {
    return NextResponse.redirect(new URL('/auth/login?verified=0', req.url))
  }

  const res = NextResponse.redirect(new URL('/auth/login?verified=1', req.url))
  res.cookies.set(EMAIL_VERIFIED_COOKIE, result.userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 30,
    path: '/',
  })

  return res
}

