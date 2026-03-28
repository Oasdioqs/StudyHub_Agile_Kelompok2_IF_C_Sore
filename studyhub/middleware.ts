import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const EMAIL_VERIFIED_COOKIE = 'email_verified_for'
const OTP_COOKIE = 'otp_verified_for'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token?.id) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calendar',
    '/calendar/:path*',
    '/tasks/:path*',
    '/notes/:path*',
    '/forum/:path*',
    '/ai-tutor/:path*',
    '/timer/:path*',
    '/profile/:path*',
  ],
}
