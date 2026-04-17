import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'StudyHub — Platform Belajar Kolaboratif untuk Mahasiswa',
  description: 'StudyHub membantu mahasiswa Indonesia belajar lebih produktif dengan AI Tutor, manajemen tugas, kelas virtual, forum diskusi, flashcard, dan Pomodoro timer. Gratis untuk dicoba.',
  keywords: ['platform belajar mahasiswa', 'ai tutor', 'manajemen tugas kuliah', 'belajar online', 'flashcard', 'catatan kuliah', 'studyhub'],
  openGraph: {
    title: 'StudyHub — Belajar Lebih Cerdas, Bukan Lebih Keras',
    description: 'Platform belajar terpadu dengan AI Tutor, manajemen tugas, kelas virtual, dan lebih banyak lagi. Bergabung gratis sekarang.',
  },
}

const FEATURES = [
  { icon: '🤖', title: 'AI Tutor Pribadi', desc: 'Tanya apa saja ke AI tutor kapanpun. Tersedia 10 pertanyaan gratis setiap hari.' },
  { icon: '📋', title: 'Manajemen Tugas', desc: 'Kelola semua tugas kuliah dengan deadline, prioritas, dan notifikasi otomatis.' },
  { icon: '👥', title: 'Kelas Virtual', desc: 'Buat atau gabung kelas dengan teman. Bagikan tugas, pengumuman, dan jadwal.' },
  { icon: '📚', title: 'Catatan Digital', desc: 'Tulis catatan dalam Markdown dengan auto-save dan bagikan ke kelas.' },
  { icon: '🃏', title: 'Flashcard', desc: 'Buat kartu belajar interaktif dan uji dirimu sebelum ujian.' },
  { icon: '⏱️', title: 'Pomodoro Timer', desc: 'Fokus belajar dengan teknik Pomodoro yang terbukti efektif.' },
  { icon: '📄', title: 'Ringkasan PDF', desc: 'Upload materi PDF dan dapatkan ringkasan otomatis dari AI.' },
  { icon: '🏆', title: 'Leaderboard', desc: 'Bersaing sehat dengan teman melalui sistem poin dan streak harian.' },
]

const STEPS = [
  { num: '01', title: 'Daftar Gratis', desc: 'Buat akun dalam 30 detik dengan email atau Google.' },
  { num: '02', title: 'Setup Profilmu', desc: 'Isi jurusan dan institusimu untuk pengalaman yang lebih personal.' },
  { num: '03', title: 'Mulai Belajar', desc: 'Tambah tugas, buat catatan, tanya AI, dan gabung kelas bersama teman.' },
]

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111827', letterSpacing: '-0.02em' }}>StudyHub</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/auth/login" style={{ color: '#6b7280', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Masuk</Link>
          <Link href="/auth/register" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
            Daftar Gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0ea5e9 100%)', padding: '80px 24px 96px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.07), transparent), radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.05), transparent)' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Platform belajar untuk mahasiswa Indonesia</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
            Belajar Lebih Cerdas,<br />Bukan Lebih Keras
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 'clamp(16px, 2.5vw, 20px)', lineHeight: 1.7, margin: '0 0 36px', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            Platform belajar terpadu dengan AI Tutor, manajemen tugas, kelas virtual,
            flashcard, dan lebih banyak lagi — semuanya gratis.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/register" style={{ background: '#fff', color: '#4f46e5', padding: '14px 28px', borderRadius: 12, fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Mulai Gratis — Tanpa Kartu Kredit
            </Link>
            <Link href="/auth/login" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.3)' }}>
              Sudah punya akun?
            </Link>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, marginTop: 16 }}>
            Bergabung dengan ribuan mahasiswa yang sudah lebih produktif
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Semua yang kamu butuhkan untuk kuliah
          </h2>
          <p style={{ color: '#6b7280', fontSize: 16, margin: 0, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Satu platform untuk semua kebutuhan belajarmu — tidak perlu buka 10 tab berbeda lagi.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: '#fff', borderRadius: 16, padding: '24px 22px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', padding: '72px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#111827', margin: '0 0 48px', letterSpacing: '-0.02em' }}>
            Mulai dalam 3 langkah mudah
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1.5px solid #c7d2fe' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#4f46e5', opacity: 0.3, marginBottom: 8, letterSpacing: '-0.03em' }}>{s.num}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Siap belajar lebih produktif?
          </h2>
          <p style={{ color: '#6b7280', fontSize: 16, margin: '0 0 32px' }}>
            Gratis selamanya untuk fitur dasar. Tidak perlu kartu kredit.
          </p>
          <Link href="/auth/register" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '16px 36px', borderRadius: 14, fontSize: 16, fontWeight: 800, textDecoration: 'none', display: 'inline-block', boxShadow: '0 8px 28px rgba(79,70,229,0.35)' }}>
            Daftar Sekarang — Gratis! 🚀
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>© {new Date().getFullYear()} StudyHub</span>
          <Link href="/privacy" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>Terms of Service</Link>
          <Link href="/auth/login" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>Masuk</Link>
          <Link href="/auth/register" style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>Daftar Gratis</Link>
        </div>
      </footer>
    </div>
  )
}
