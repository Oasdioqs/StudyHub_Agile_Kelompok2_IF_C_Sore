import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const OTP_COOKIE = 'otp_verified_for'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token?.id) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Cek apakah pengguna sudah melewati verifikasi OTP
  const otpVerifiedFor = req.cookies.get(OTP_COOKIE)?.value
  if (otpVerifiedFor !== token.id) {
    return NextResponse.redirect(new URL('/auth/verify-login-otp', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calendar',
    '/calendar/:path*',
    '/kelas',
    '/kelas/:path*',
    '/tasks/:path*',
    '/notes/:path*',
    '/forum/:path*',
    '/flashcards/:path*',
    '/ai-tutor/:path*',
    '/timer/:path*',
    '/leaderboard/:path*',
    '/analytics/:path*',
    '/profile/:path*',
  ],
}
