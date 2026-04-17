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

// ─── Email helper: base template wrapper ─────────────────────────────────────
function emailBase(content: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
        style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(17,24,39,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;">
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.02em;">
            StudyHub
          </div>
        </td></tr>
        <tr><td style="padding:28px 28px 20px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
          ${content}
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
          <div style="height:1px;background:#eef2ff;margin-bottom:16px;"></div>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} StudyHub ·
            <a href="${process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'}/privacy" style="color:#6b7280;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:13px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;text-decoration:none;font-size:14px;font-weight:800;">
    ${label}
  </a>`
}

// ─── Welcome Email ────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">
      Selamat datang, ${firstName}! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
      Akunmu sudah aktif. StudyHub siap membantumu belajar lebih produktif setiap hari.
    </p>
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111827;">Mulai dari sini:</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;font-size:14px;line-height:2;">
      <li>📋 <strong>Tambah tugas</strong> pertamamu dengan deadline</li>
      <li>📚 <strong>Buat catatan</strong> dari materi kuliah hari ini</li>
      <li>🤖 <strong>Tanya AI Tutor</strong> tentang pelajaran yang membingungkan</li>
      <li>👥 <strong>Gabung kelas</strong> bersama teman-teman</li>
    </ul>
    ${emailButton(`${baseUrl}/dashboard`, 'Mulai Belajar Sekarang →')}
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
      Butuh bantuan? Balas email ini — kami siap membantu.
    </p>
  `

  await sendEmail({ to, subject: `Selamat datang di StudyHub, ${firstName}! 🎓`, html: emailBase(content) }).catch(() => null)
}

// ─── Tips Email (Day 3) ───────────────────────────────────────────────────────
export async function sendTipsEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">
      ${firstName}, ada tips untuk kamu 💡
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
      Pengguna StudyHub yang paling produktif punya satu kebiasaan: mereka review tugas mereka setiap pagi.
    </p>
    <div style="background:#eef2ff;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#4338ca;">🏆 Fitur favorit pengguna aktif:</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#4b5563;font-size:13.5px;line-height:1.9;">
        <li><strong>Flashcard</strong> — uji dirimu sebelum ujian</li>
        <li><strong>AI Tutor</strong> — 10 pertanyaan gratis setiap hari</li>
        <li><strong>Pomodoro Timer</strong> — fokus 25 menit, istirahat 5 menit</li>
      </ul>
    </div>
    ${emailButton(`${baseUrl}/dashboard`, 'Buka StudyHub →')}
  `

  await sendEmail({ to, subject: `Tips belajar untuk ${firstName} 📚`, html: emailBase(content) }).catch(() => null)
}

// ─── Re-engagement Email (Day 7+) ────────────────────────────────────────────
export async function sendReengagementEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">
      ${firstName}, jangan sampai tertinggal! ⏰
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
      Sudah beberapa hari kamu tidak aktif di StudyHub. Mungkin ada tugas yang perlu diperhatikan?
    </p>
    ${emailButton(`${baseUrl}/tasks`, 'Cek Tugasku Sekarang →')}
    <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#9ca3af;">
      Tidak ingin menerima email ini? Kamu bisa mengatur preferensi notifikasi di
      <a href="${baseUrl}/profile" style="color:#6b7280;">pengaturan profil</a>.
    </p>
  `

  await sendEmail({ to, subject: `${firstName}, ada yang menunggu di StudyHub 📬`, html: emailBase(content) }).catch(() => null)
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
