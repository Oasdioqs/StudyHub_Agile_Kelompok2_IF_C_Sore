import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { db } from '@/lib/db'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.EMAIL_FROM || `StudyHub <${process.env.SMTP_USER}>`

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP belum dikonfigurasi (SMTP_USER / SMTP_PASS).')
  }
  const result = await transporter.sendMail({ from: FROM, to, subject, html })
  return { messageId: result.messageId }
}

// ─── Email template helpers ───────────────────────────────────────────────────
function emailBase(content: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
        style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(17,24,39,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:18px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${baseUrl}/logo.svg" width="34" height="34" alt="S" style="display:block;border-radius:8px;border:0;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:ui-sans-serif,system-ui,sans-serif;color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.02em;">StudyHub</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 28px 20px;font-family:ui-sans-serif,system-ui,sans-serif;">
          ${content}
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-family:ui-sans-serif,system-ui,sans-serif;">
          <div style="height:1px;background:#eef2ff;margin-bottom:16px;"></div>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} StudyHub &bull;
            <a href="${baseUrl}/privacy" style="color:#9ca3af;text-decoration:underline;">Privacy Policy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:13px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;text-decoration:none;font-size:14px;font-weight:800;">${label}</a>`
}

// ─── Welcome Email ────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Selamat datang, ${firstName}! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">Akunmu sudah aktif. StudyHub siap membantumu belajar lebih produktif.</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;font-size:14px;line-height:2;">
      <li>📋 <strong>Tambah tugas</strong> pertamamu dengan deadline</li>
      <li>📚 <strong>Buat catatan</strong> dari materi kuliah</li>
      <li>🤖 <strong>Tanya AI Tutor</strong> kapanpun</li>
      <li>👥 <strong>Gabung kelas</strong> bersama teman</li>
    </ul>
    ${emailButton(`${baseUrl}/dashboard`, 'Mulai Belajar Sekarang →')}
  `
  await sendEmail({ to, subject: `Selamat datang di StudyHub, ${firstName}! 🎓`, html: emailBase(content) }).catch(() => null)
}

// ─── Tips Email ───────────────────────────────────────────────────────────────
export async function sendTipsEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">${firstName}, ada tips untuk kamu 💡</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">Pengguna paling produktif review tugas mereka setiap pagi.</p>
    <div style="background:#eef2ff;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <ul style="margin:0;padding-left:20px;color:#4b5563;font-size:13.5px;line-height:1.9;">
        <li><strong>Flashcard</strong> — uji dirimu sebelum ujian</li>
        <li><strong>AI Tutor</strong> — 10 pertanyaan gratis setiap hari</li>
        <li><strong>Pomodoro Timer</strong> — fokus 25 menit, istirahat 5 menit</li>
      </ul>
    </div>
    ${emailButton(`${baseUrl}/dashboard`, 'Buka StudyHub →')}
  `
  await sendEmail({ to, subject: `Tips belajar untuk ${firstName} 📚`, html: emailBase(content) }).catch(() => null)
}

// ─── Re-engagement Email ──────────────────────────────────────────────────────
export async function sendReengagementEmail(to: string, name: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'
  const firstName = name.split(' ')[0]
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">${firstName}, jangan sampai tertinggal! ⏰</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">Sudah beberapa hari kamu tidak aktif. Mungkin ada tugas yang perlu diperhatikan?</p>
    ${emailButton(`${baseUrl}/tasks`, 'Cek Tugasku Sekarang →')}
  `
  await sendEmail({ to, subject: `${firstName}, ada yang menunggu di StudyHub 📬`, html: emailBase(content) }).catch(() => null)
}

// ─── Verification Email ───────────────────────────────────────────────────────
export async function resendVerificationEmail(email: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await db.verificationToken.create({ data: { identifier: email, token, expires } })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Konfirmasi Email</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">Terima kasih telah bergabung di StudyHub. Klik tombol berikut untuk memverifikasi akunmu.</p>
    ${emailButton(verifyUrl, 'Verifikasi Email')}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Link berlaku selama 24 jam.</p>
  `

  try {
    const result = await sendEmail({ to: email, subject: 'Konfirmasi Email - StudyHub', html: emailBase(content) })
    return { success: true, messageId: result.messageId }
  } catch (error: any) {
    return { error: { message: error.message || 'Gagal mengirim email verifikasi.' } }
  }
}

// ─── OTP Email ───────────────────────────────────────────────────────────────
export async function sendOtpEmail(to: string, otp: string) {
  // Format: "994 365" — dua grup 3 digit, satu baris, tidak wrap
  const otpFormatted = `${otp.slice(0, 3)}&thinsp;${otp.slice(3)}`

  const content = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Kode Verifikasi Login</h1>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#6b7280;">
      Masukkan kode ini untuk menyelesaikan login ke StudyHub.
      Berlaku selama <strong>10 menit</strong>.
    </p>

    <!-- Kode OTP — dark premium style -->
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:16px;padding:28px 24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(199,210,254,0.7);text-transform:uppercase;">Kode Verifikasi</p>
      <div style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:44px;font-weight:800;letter-spacing:0.06em;color:#ffffff;line-height:1;white-space:nowrap;">
        ${otpFormatted}
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:rgba(199,210,254,0.6);">Berlaku 10 menit &bull; Gunakan sekali saja</p>
    </div>

    <p style="margin:0 0 4px;font-size:12.5px;color:#9ca3af;line-height:1.7;">
      🔒 Jangan bagikan kode ini kepada siapapun. Tim StudyHub tidak akan pernah memintanya.
      Jika bukan kamu yang login, abaikan email ini.
    </p>
  `
  return sendEmail({ to, subject: `${otp.slice(0,3)} ${otp.slice(3)} — Kode OTP StudyHub`, html: emailBase(content) })
}

// ─── Reset Password Email ─────────────────────────────────────────────────────
export async function sendResetPasswordEmail(to: string, link: string) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Reset Password</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">Kami menerima permintaan reset password. Klik tombol berikut untuk mengatur password baru.</p>
    ${emailButton(link, 'Reset Password')}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Link berlaku selama <b>15 menit</b>. Abaikan email ini jika bukan kamu yang meminta.</p>
  `
  return sendEmail({ to, subject: 'Reset Password StudyHub 🔐', html: emailBase(content) })
}
