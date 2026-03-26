import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const OTP_COOKIE_NAME = 'otp_verified_for'
const EMAIL_VERIFIED_COOKIE_NAME = 'email_verified_for'

export async function POST() {
  cookies().set(OTP_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
  cookies().set(EMAIL_VERIFIED_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
