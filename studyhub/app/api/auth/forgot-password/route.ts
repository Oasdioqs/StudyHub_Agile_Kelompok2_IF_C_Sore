import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
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

  const link = `http://localhost:3000/auth/reset-password?token=${token}`

  await resend.emails.send({
    from: 'StudyHub <onboarding@resend.dev>',
    to: email,
    subject: 'Reset Password StudyHub 🔐',
    html: `
        <div style="font-family:sans-serif;">
        <h2>Reset Password</h2>
        <p>Klik tombol di bawah untuk reset password kamu:</p>

        <a href="${link}" 
            style="
            display:inline-block;
            padding:12px 20px;
            background:#6366f1;
            color:white;
            border-radius:8px;
            text-decoration:none;
            ">
            Reset Password
        </a>

        <p style="margin-top:10px;">
            Link ini berlaku 15 menit.
        </p>
        </div>
    `,
    })

  console.log('RESET LINK:', link) // 🔥 sementara

  return NextResponse.json({ message: 'Link reset dikirim' })
}