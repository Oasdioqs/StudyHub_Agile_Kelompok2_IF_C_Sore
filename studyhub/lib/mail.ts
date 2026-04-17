import { Resend } from 'resend'
import crypto from 'crypto'
import { db } from '@/lib/db'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'StudyHub <noreply@studyhub.app>'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY belum dikonfigurasi.')
  }

  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(error.message)
  return { messageId: data?.id }
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

// ─── Re-engagement Email ──────────────────────────────────────────────────────
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

// ─── Verification Email ───────────────────────────────────────────────────────
export async function resendVerificationEmail(email: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24)

  await db.verificationToken.create({ data: { identifier: email, token, expires } })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Konfirmasi Email</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
      Terima kasih telah bergabung di StudyHub. Klik tombol di bawah untuk memverifikasi akunmu.
    </p>
    ${emailButton(verifyUrl, 'Verifikasi Email')}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Link berlaku selama 24 jam.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">
      Atau copy link ini: <a href="${verifyUrl}" style="color:#4f46e5;word-break:break-all;">${verifyUrl}</a>
    </p>
  `

  try {
    const result = await sendEmail({ to: email, subject: 'Konfirmasi Email - StudyHub', html: emailBase(content) })
    return { success: true, messageId: result.messageId }
  } catch (error: any) {
    return { error: { message: error.message || 'Gagal mengirim email verifikasi.' } }
  }
}

// ─── Reset Password Email ─────────────────────────────────────────────────────
export async function sendResetPasswordEmail(to: string, link: string) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Reset Password</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
      Kami menerima permintaan untuk mereset password akun kamu. Gunakan tombol di bawah untuk mengatur password baru.
    </p>
    ${emailButton(link, 'Reset Password')}
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Link ini berlaku selama <b>15 menit</b>.</p>
    <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">
      Jika kamu tidak meminta reset password, abaikan email ini.
    </p>
  `
  return sendEmail({ to, subject: 'Reset Password StudyHub 🔐', html: emailBase(content) })
}
