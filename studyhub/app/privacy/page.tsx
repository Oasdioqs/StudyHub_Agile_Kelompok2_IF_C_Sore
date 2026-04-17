import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Kebijakan privasi StudyHub — cara kami mengumpulkan, menggunakan, dan melindungi data kamu.',
}

const LAST_UPDATED = '18 April 2026'
const CONTACT_EMAIL = 'privacy@studyhub.app'
const APP_URL = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--sh-bg, #f8fafc)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', padding: '48px 24px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <i className="bi bi-arrow-left" /> Kembali ke StudyHub
          </Link>
          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: 14 }}>
            Terakhir diperbarui: {LAST_UPDATED}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', lineHeight: 1.8, color: '#374151', fontSize: 15 }}>

          <Section title="1. Pendahuluan">
            <p>
              StudyHub (&ldquo;kami&rdquo;, &ldquo;milik kami&rdquo;) menghormati privasi kamu. Kebijakan Privasi ini menjelaskan
              bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi informasi pribadi kamu
              saat menggunakan layanan StudyHub di <a href={APP_URL} style={{ color: '#4f46e5' }}>{APP_URL}</a> dan
              aplikasi mobile kami.
            </p>
            <p>
              Dengan menggunakan StudyHub, kamu menyetujui pengumpulan dan penggunaan informasi sesuai
              dengan kebijakan ini.
            </p>
          </Section>

          <Section title="2. Informasi yang Kami Kumpulkan">
            <SubSection title="2.1 Informasi yang Kamu Berikan">
              <ul>
                <li><strong>Akun:</strong> Nama, alamat email, password (disimpan dalam bentuk hash terenkripsi)</li>
                <li><strong>Konten:</strong> Catatan, tugas, flashcard, postingan forum yang kamu buat</li>
                <li><strong>Profil:</strong> Foto profil (dari Google jika login dengan Google)</li>
                <li><strong>Komunikasi:</strong> Pesan dukungan yang kamu kirim ke kami</li>
              </ul>
            </SubSection>
            <SubSection title="2.2 Informasi yang Dikumpulkan Otomatis">
              <ul>
                <li><strong>Data penggunaan:</strong> Halaman yang dikunjungi, fitur yang digunakan, waktu sesi</li>
                <li><strong>Perangkat:</strong> Jenis browser, sistem operasi, resolusi layar</li>
                <li><strong>Log server:</strong> Alamat IP, timestamp request, kode respons HTTP</li>
                <li><strong>Analytics:</strong> Data perilaku pengguna (melalui PostHog, bersifat anonim)</li>
              </ul>
            </SubSection>
            <SubSection title="2.3 Informasi dari Pihak Ketiga">
              <ul>
                <li><strong>Google OAuth:</strong> Nama, email, foto profil (hanya saat kamu memilih login dengan Google)</li>
                <li><strong>Firebase:</strong> Token notifikasi push untuk pengiriman notifikasi</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. Cara Kami Menggunakan Informasi">
            <p>Kami menggunakan informasi kamu untuk:</p>
            <ul>
              <li>Menyediakan, menjalankan, dan meningkatkan layanan StudyHub</li>
              <li>Memproses pendaftaran dan autentikasi akun</li>
              <li>Mengirim notifikasi terkait aktivitas (tugas, pengumuman kelas, dll)</li>
              <li>Memberikan respons atas pertanyaan dan dukungan</li>
              <li>Menganalisis penggunaan untuk meningkatkan pengalaman pengguna</li>
              <li>Mendeteksi dan mencegah penipuan atau penyalahgunaan</li>
              <li>Memenuhi kewajiban hukum yang berlaku</li>
            </ul>
            <p>
              <strong>Kami TIDAK menjual data pribadi kamu kepada pihak ketiga manapun.</strong>
            </p>
          </Section>

          <Section title="4. Penyimpanan & Keamanan Data">
            <p>
              Data kamu disimpan di server database PostgreSQL yang aman. Kami menerapkan langkah-langkah
              keamanan teknis meliputi:
            </p>
            <ul>
              <li>Password di-hash menggunakan bcrypt (salt rounds 12)</li>
              <li>Komunikasi dienkripsi menggunakan HTTPS/TLS</li>
              <li>Token autentikasi JWT dengan masa berlaku terbatas</li>
              <li>Rate limiting untuk mencegah serangan brute force</li>
              <li>Header keamanan HTTP (HSTS, CSP, X-Frame-Options)</li>
            </ul>
            <p>
              Meski kami berupaya melindungi data kamu, tidak ada metode transmisi atau penyimpanan
              elektronik yang 100% aman.
            </p>
          </Section>

          <Section title="5. Berbagi Data dengan Pihak Ketiga">
            <p>Kami hanya berbagi data dengan layanan berikut untuk menjalankan aplikasi:</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Layanan</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Tujuan</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Vercel', 'Hosting & deployment', 'Log server'],
                  ['Google', 'Login OAuth', 'Email, nama, foto (opt-in)'],
                  ['Firebase', 'Push notification', 'Token perangkat'],
                  ['OpenRouter', 'AI Tutor', 'Pesan chat (tidak disimpan oleh OpenRouter)'],
                  ['PostHog', 'Analytics', 'Data penggunaan (anonim)'],
                  ['Nodemailer/SMTP', 'Email', 'Alamat email'],
                ].map(([service, purpose, data]) => (
                  <tr key={service} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{service}</td>
                    <td style={{ padding: '10px 12px' }}>{purpose}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="6. Hak Kamu (GDPR & Privasi Global)">
            <p>Kamu memiliki hak atas data pribadi kamu, termasuk:</p>
            <ul>
              <li><strong>Akses:</strong> Minta salinan data pribadi yang kami simpan</li>
              <li><strong>Koreksi:</strong> Perbaiki data yang tidak akurat</li>
              <li><strong>Penghapusan:</strong> Minta penghapusan akun dan semua data terkait</li>
              <li><strong>Portabilitas:</strong> Ekspor data kamu dalam format yang dapat dibaca mesin</li>
              <li><strong>Keberatan:</strong> Tolak pemrosesan data untuk tujuan tertentu</li>
              <li><strong>Pembatasan:</strong> Batasi cara kami menggunakan data kamu</li>
            </ul>
            <p>
              Untuk menggunakan hak-hak ini, hubungi kami di{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#4f46e5' }}>{CONTACT_EMAIL}</a>.
              Kami akan merespons dalam 30 hari.
            </p>
          </Section>

          <Section title="7. Cookie & Penyimpanan Lokal">
            <p>StudyHub menggunakan:</p>
            <ul>
              <li><strong>Cookie sesi:</strong> Untuk menjaga status login kamu (wajib, tidak dapat dinonaktifkan)</li>
              <li><strong>Cookie OTP:</strong> Untuk verifikasi dua langkah</li>
              <li><strong>localStorage:</strong> Untuk preferensi UI (tema, pengaturan tampilan)</li>
              <li><strong>Analytics cookie:</strong> PostHog untuk memahami penggunaan fitur (dapat dinonaktifkan)</li>
            </ul>
          </Section>

          <Section title="8. Data Anak-anak">
            <p>
              StudyHub ditujukan untuk pengguna berusia 13 tahun ke atas. Kami tidak secara sengaja
              mengumpulkan data pribadi dari anak-anak di bawah 13 tahun. Jika kamu mengetahui
              adanya data anak di bawah umur di platform kami, hubungi kami segera.
            </p>
          </Section>

          <Section title="9. Perubahan Kebijakan">
            <p>
              Kami dapat memperbarui kebijakan ini sewaktu-waktu. Perubahan signifikan akan diinformasikan
              melalui email atau notifikasi di dalam aplikasi. Tanggal &ldquo;Terakhir diperbarui&rdquo; di bagian
              atas halaman ini menunjukkan kapan kebijakan terakhir direvisi.
            </p>
          </Section>

          <Section title="10. Hubungi Kami">
            <p>
              Jika kamu memiliki pertanyaan tentang kebijakan privasi ini atau ingin menggunakan
              hak privasimu, hubungi:
            </p>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginTop: 8 }}>
              <p style={{ margin: 0 }}><strong>StudyHub Privacy Team</strong></p>
              <p style={{ margin: '4px 0 0' }}>Email: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#4f46e5' }}>{CONTACT_EMAIL}</a></p>
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #eef2ff' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  )
}
