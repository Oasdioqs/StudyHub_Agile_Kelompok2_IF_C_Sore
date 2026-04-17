import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendOtpEmail, resendVerificationEmail } from '@/lib/mail'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

const OTP_COOKIE_RATE_LIMIT_MS = 60 * 1000
const OTP_EXPIRES_MS = 10 * 60 * 1000
const EMAIL_SEND_TIMEOUT_MS = 8000
const DB_OP_TIMEOUT_MS = 5000

function generateOtp() {
  const num = Math.floor(Math.random() * 1_000_000)
  return String(num).padStart(6, '0')
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function sendWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<{ timedOut: boolean; result?: T }> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<{ timedOut: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
  })
  const result = await Promise.race([
    promise.then((res) => ({ timedOut: false as const, result: res })),
    timeoutPromise,
  ])
  if (timer) clearTimeout(timer)
  return result as { timedOut: boolean; result?: T }
}

function isDbPoolError(err: unknown) {
  const msg = String((err as any)?.message || err || '')
  return (
    /Timed out fetching a new connection from the connection pool/i.test(msg) ||
    /Unable to check out connection from the pool/i.test(msg) ||
    /Error in PostgreSQL connection: Error \{ kind: Closed/i.test(msg)
  )
}

async function dbWithTimeout<T>(promise: Promise<T>) {
  const result = await sendWithTimeout(promise, DB_OP_TIMEOUT_MS)
  if (result.timedOut) throw new Error('DB_TIMEOUT')
  return result.result as T
}

async function resendVerificationEmailFast(email: string) {
  const result = await sendWithTimeout(resendVerificationEmail(email), EMAIL_SEND_TIMEOUT_MS)
  if (result.timedOut) {
    return { timedOut: true, error: null as string | null }
  }
  const err = (result.result as any)?.error
  return { timedOut: false, error: err?.message || null }
}

export async function POST(req: NextRequest) {
  try {
    const lastOtpAtCookie = Number(req.cookies.get('otp_rl')?.value || '0')
    if (lastOtpAtCookie && Date.now() - lastOtpAtCookie < OTP_COOKIE_RATE_LIMIT_MS) {
      const waitSec = Math.ceil((OTP_COOKIE_RATE_LIMIT_MS - (Date.now() - lastOtpAtCookie)) / 1000)
      return NextResponse.json({ message: `Tunggu ${waitSec} detik sebelum kirim OTP lagi.` }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { email, password } = body as { email?: string; password?: string }
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    let userId: string | null = null
    let userEmail: string | null = null
    let provider: string = 'credentials'

    if (typeof password === 'string') {
      if (!normalizedEmail) {
        return NextResponse.json({ message: 'Email wajib diisi.' }, { status: 400 })
      }

      const user = await dbWithTimeout(db.user.findUnique({ where: { email: normalizedEmail } }))
      if (!user || !user.password) {
        return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 })
      }

      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 })
      }

      if (!user.emailVerified) {
        const sendResult = await resendVerificationEmailFast(user.email)
        if (sendResult.error) {
          return NextResponse.json(
            { message: sendResult.error || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
            { status: 500 },
          )
        }
        return NextResponse.json(
          {
            message: sendResult.timedOut
              ? 'Email belum terverifikasi. Pengiriman link verifikasi sedang diproses, coba cek inbox beberapa saat lagi.'
              : 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.',
          },
          { status: 403 },
        )
      }

      userId = user.id
      userEmail = user.email
      provider = 'credentials'
    } else {
      const user =
        normalizedEmail
          ? await dbWithTimeout(db.user.findUnique({ where: { email: normalizedEmail } }))
          : null

      if (!user) {
        const session = await getServerSession(authOptions)
        const sessionUserId = session?.user?.id
        if (!sessionUserId) {
          return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const sessionUser = await dbWithTimeout(db.user.findUnique({ where: { id: sessionUserId } }))
        if (!sessionUser) {
          return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 })
        }

        if (!sessionUser.emailVerified) {
          const sendResult = await resendVerificationEmailFast(sessionUser.email)
          if (sendResult.error) {
            return NextResponse.json(
              { message: sendResult.error || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
              { status: 500 },
            )
          }
          return NextResponse.json(
            {
              message: sendResult.timedOut
                ? 'Email belum terverifikasi. Pengiriman link verifikasi sedang diproses, coba cek inbox beberapa saat lagi.'
                : 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.',
            },
            { status: 403 },
          )
        }

        userId = sessionUser.id
        userEmail = sessionUser.email
        provider = 'google'
      } else {
        if (!user.emailVerified) {
          const sendResult = await resendVerificationEmailFast(user.email)
          if (sendResult.error) {
            return NextResponse.json(
              { message: sendResult.error || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
              { status: 500 },
            )
          }
          return NextResponse.json(
            {
              message: sendResult.timedOut
                ? 'Email belum terverifikasi. Pengiriman link verifikasi sedang diproses, coba cek inbox beberapa saat lagi.'
                : 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.',
            },
            { status: 403 },
          )
        }

        userId = user.id
        userEmail = user.email
        provider = 'google'
      }
    }

    if (!userId || !userEmail) {
      return NextResponse.json({ message: 'Gagal menentukan user.' }, { status: 400 })
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS)
    const codeHash = sha256(otp)

    await dbWithTimeout(db.loginOtp.create({
      data: {
        userId,
        codeHash,
        expiresAt,
        usedAt: null,
        provider,
        lastSentAt: new Date(),
      },
    }))

    const sendResult = await sendWithTimeout(sendOtpEmail(userEmail, otp), EMAIL_SEND_TIMEOUT_MS)

    if (sendResult.timedOut) {
      const res = NextResponse.json({ message: 'OTP sedang diproses pengirimannya. Cek email dalam beberapa detik.' })
      res.cookies.set('otp_rl', String(Date.now()), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60,
        path: '/',
      })
      return res
    }

    const sendError = (sendResult.result as any)?.error
    if (sendError) {
      return NextResponse.json({ message: sendError.message || 'Gagal mengirim OTP. Coba lagi.' }, { status: 500 })
    }

    const res = NextResponse.json({ message: 'OTP berhasil dikirim ke email kamu.' })
    res.cookies.set('otp_rl', String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60,
      path: '/',
    })
    return res
  } catch (err) {
    if (String((err as any)?.message || '') === 'DB_TIMEOUT' || isDbPoolError(err)) {
      return NextResponse.json(
        { message: 'Server lagi ramai. Coba kirim OTP lagi dalam 10-20 detik.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ message: 'Gagal mengirim OTP. Coba lagi.' }, { status: 500 })
  }
}
