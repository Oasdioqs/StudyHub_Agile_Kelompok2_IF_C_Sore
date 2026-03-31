import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/mail'

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

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const link = `${baseUrl}/auth/reset-password?token=${token}`

  try {
    const result = await sendEmail({
      to: email,
    subject: 'Reset Password StudyHub 🔐',
    html: `
      <!doctype html>
      <html>
        <body style="margin:0; padding:0; background:#f6f7fb;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(17,24,39,0.08);">
                  <tr>
                    <td style="padding:26px 24px 0;">
                      <div style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#6b7280; font-size:13px; font-weight:700; letter-spacing:0.02em;">
                        STUDYHUB
                      </div>
                      <h1 style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:24px; line-height:1.3; color:#111827;">
                        Reset Password
                      </h1>
                      <p style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:15px; line-height:1.6; color:#4b5563;">
                        Kami menerima permintaan untuk mereset password akun kamu. Gunakan tombol di bawah untuk mengatur password baru.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px 24px;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="border-radius:12px; background:#4f46e5;">
                            <a href="${link}"
                              style="display:inline-block; padding:13px 20px; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:14px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:12px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:14px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:13px; line-height:1.6; color:#6b7280;">
                        Link ini berlaku selama <b>15 menit</b>.
                      </p>

                      <p style="margin:10px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:13px; line-height:1.6; color:#6b7280;">
                        Jika tombol tidak bisa diklik, kamu bisa membuka link ini:
                        <br />
                        <a href="${link}" style="color:#4f46e5; text-decoration:underline; word-break:break-all;">${link}</a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 24px 26px;">
                      <div style="height:1px; background:#eef2ff;"></div>
                      <p style="margin:18px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:12.5px; line-height:1.6; color:#6b7280;">
                        Jika kamu tidak meminta reset password, abaikan email ini.
                      </p>
                      <p style="margin:10px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:12.5px; line-height:1.6; color:#9ca3af;">
                        © ${new Date().getFullYear()} StudyHub. All rights reserved.
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

    console.log('RESET LINK:', link)

    return NextResponse.json({ message: 'Link reset dikirim', messageId: result.messageId })
  } catch (error: any) {
    console.error('MAIL SEND ERROR:', error)
    return NextResponse.json(
      {
        message: error.message || 'Gagal mengirim email reset password.',
      },
      { status: 500 },
    )
  }
}