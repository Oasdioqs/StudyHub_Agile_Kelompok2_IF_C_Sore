import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

const OTP_COOKIE_RATE_LIMIT_MS = 60 * 1000
const OTP_EXPIRES_MS = 10 * 60 * 1000
const EMAIL_SEND_TIMEOUT_MS = 8000

function generateOtp() {
  const num = Math.floor(Math.random() * 1_000_000)
  return String(num).padStart(6, '0')
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function resendVerificationEmail(email: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`

  const from = process.env.EMAIL_FROM || 'StudyHub <onboarding@resend.dev>'
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const result = await resend.emails.send({
    from,
    to: email,
    subject: 'Confirm Email - StudyHub',
    html: `
      <!doctype html>
      <html>
        <body style="margin:0; padding:0; background:#f6f7fb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(17,24,39,0.08);">
                  <tr>
                    <td style="padding:26px 24px 6px;">
                      <div style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#6b7280; font-size:13px; font-weight:700;">
                        STUDYHUB
                      </div>
                      <h1 style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:24px; color:#111827;">
                        Konfirmasi Email
                      </h1>
                      <p style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:15px; line-height:1.6; color:#4b5563;">
                        Kamu belum verifikasi email. Klik tombol ini untuk verifikasi akun kamu.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 26px;">
                      <a href="${verifyUrl}" style="display:inline-block; padding:13px 20px; background:#4f46e5; color:#fff; border-radius:12px; text-decoration:none; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:14px; font-weight:800;">
                        Verify Email
                      </a>
                      <p style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:13px; color:#6b7280;">
                        Link berlaku 24 jam.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  })

  return result
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, password } = body as { email?: string; password?: string }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ message: 'RESEND_API_KEY belum diset.' }, { status: 500 })
  }

  let userId: string | null = null
  let userEmail: string | null = null
  let provider: string = 'credentials'

  if (typeof password === 'string') {
    if (!email) {
      return NextResponse.json({ message: 'Email wajib diisi.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 })
    }

    if (!user.emailVerified) {
      const sendResult = await resendVerificationEmail(user.email)
      if ((sendResult as any)?.error) {
        return NextResponse.json(
          { message: (sendResult as any).error.message || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
          { status: 500 },
        )
      }
      return NextResponse.json(
        { message: 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.' },
        { status: 403 },
      )
    }

    userId = user.id
    userEmail = user.email
    provider = 'credentials'
  } else {
    const user =
      typeof email === 'string' && email
        ? await db.user.findUnique({ where: { email } })
        : null

    if (!user) {
      const session = await getServerSession(authOptions)
      const sessionUserId = session?.user?.id
      if (!sessionUserId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
      }

      const sessionUser = await db.user.findUnique({ where: { id: sessionUserId } })
      if (!sessionUser) {
        return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 })
      }

      if (!sessionUser.emailVerified) {
        const sendResult = await resendVerificationEmail(sessionUser.email)
        if ((sendResult as any)?.error) {
          return NextResponse.json(
            { message: (sendResult as any).error.message || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
            { status: 500 },
          )
        }
        return NextResponse.json(
          { message: 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.' },
          { status: 403 },
        )
      }

      userId = sessionUser.id
      userEmail = sessionUser.email
      provider = 'google'
    } else {
      if (!user.emailVerified) {
        const sendResult = await resendVerificationEmail(user.email)
        if ((sendResult as any)?.error) {
          return NextResponse.json(
            { message: (sendResult as any).error.message || 'Email belum terverifikasi dan gagal kirim ulang link verifikasi.' },
            { status: 500 },
          )
        }
        return NextResponse.json(
          { message: 'Email kamu belum terverifikasi. Link verifikasi sudah kami kirim ulang.' },
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

  const lastActive = await db.loginOtp.findFirst({
    where: { userId, usedAt: null },
    orderBy: { lastSentAt: 'desc' },
  })

  if (lastActive) {
    const age = Date.now() - lastActive.lastSentAt.getTime()
    if (age < OTP_COOKIE_RATE_LIMIT_MS) {
      return NextResponse.json(
        { message: `Tunggu ${Math.ceil((OTP_COOKIE_RATE_LIMIT_MS - age) / 1000)} detik sebelum kirim OTP lagi.` },
        { status: 429 },
      )
    }
  }

  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS)
  const codeHash = sha256(otp)

  await db.loginOtp.create({
    data: {
      userId,
      codeHash,
      expiresAt,
      usedAt: null,
      provider,
      lastSentAt: new Date(),
    },
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const sendResult = await sendWithTimeout(resend.emails.send({
    from: process.env.EMAIL_FROM || 'StudyHub <onboarding@resend.dev>',
    to: userEmail,
      subject: 'Login Verification Code - StudyHub',
    html: `
      <!doctype html>
      <html>
        <body style="margin:0; padding:0; background:#f6f7fb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(17,24,39,0.08);">
                  <tr>
                    <td style="padding:26px 24px 10px;">
                      <div style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#6b7280; font-size:13px; font-weight:700; letter-spacing:0.02em;">
                        STUDYHUB
                      </div>
                      <h1 style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:20px; line-height:1.3; color:#111827;">
                        Kode Verifikasi Login
                      </h1>
                      <p style="margin:10px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:14px; line-height:1.6; color:#4b5563;">
                        Masukkan kode berikut untuk menyelesaikan login. Kode berlaku selama <b>10 menit</b>.
                        <br />
                        Kode ini hanya bisa dipakai sekali untuk login kali ini.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 24px 26px;">
                      <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:28px; font-weight:800; letter-spacing:0.12em; color:#4f46e5; background:#eef2ff; border-radius:12px; padding:18px; text-align:center;">
                        ${otp}
                      </div>
                      <p style="margin:14px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:12.5px; line-height:1.6; color:#9ca3af;">
                        Jangan pernah share kode OTP ini ke siapa pun.
                      </p>

                      <p style="margin:10px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:12.5px; line-height:1.6; color:#9ca3af;">
                        Jika kamu tidak meminta kode ini, abaikan email ini.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  }), EMAIL_SEND_TIMEOUT_MS)

  if (sendResult.timedOut) {
    return NextResponse.json({ message: 'OTP sedang diproses pengirimannya. Cek email dalam beberapa detik.' })
  }

  const sendError = (sendResult.result as any)?.error
  if (sendError) {
    return NextResponse.json({ message: sendError.message || 'Gagal mengirim OTP. Coba lagi.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'OTP berhasil dikirim ke email kamu.' })
}

