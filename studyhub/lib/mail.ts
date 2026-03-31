import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { db } from '@/lib/db'
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // Use SSL/TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const from = process.env.EMAIL_FROM || 'StudyHub <noreply@studyhub.com>'

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP configuration is missing (SMTP_USER or SMTP_PASS).')
    throw new Error('Konfigurasi SMTP email belum diset.')
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
  })
}

export async function resendVerificationEmail(email: string) {
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

  try {
    const result = await sendEmail({
      to: email,
      subject: 'Konfirmasi Email - StudyHub',
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
                        Terima kasih telah bergabung di StudyHub. Silahkan klik tombol ini untuk memverifikasi akun kamu.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 26px;">
                      <a href="${verifyUrl}" style="display:inline-block; padding:13px 20px; background:#4f46e5; color:#fff; border-radius:12px; text-decoration:none; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:14px; font-weight:800;">
                        Verifikasi Email
                      </a>
                      <p style="margin:12px 0 0; font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:13px; color:#6b7280;">
                        Link berlaku selama 24 jam.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
    })
    return { success: true, messageId: result.messageId }
  } catch (error: any) {
    console.error('VERIFICATION EMAIL ERROR:', error)
    return { error: { message: error.message || 'Gagal mengirim email verifikasi.' } }
  }
}
