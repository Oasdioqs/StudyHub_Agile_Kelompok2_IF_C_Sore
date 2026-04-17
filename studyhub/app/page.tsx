'use client'

import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const FEATURES = [
  { icon: '🤖', title: 'AI Tutor Pribadi', desc: 'Tanya apa saja ke AI kapanpun. Jawaban cerdas real-time sesuai data belajarmu.', color: '#6366f1' },
  { icon: '📋', title: 'Manajemen Tugas', desc: 'Kelola deadline, prioritas, dan notifikasi otomatis. Tidak ada tugas yang terlewat.', color: '#8b5cf6' },
  { icon: '👥', title: 'Kelas Virtual', desc: 'Buat atau gabung kelas. Bagikan tugas, pengumuman, dan jadwal dengan mudah.', color: '#0ea5e9' },
  { icon: '📚', title: 'Catatan Digital', desc: 'Markdown editor dengan auto-save. Tulis, simpan, dan bagikan ke kelas.', color: '#10b981' },
  { icon: '🃏', title: 'Flashcard Interaktif', desc: 'Buat kartu belajar dan uji dirimu. Dijamin lebih siap sebelum ujian.', color: '#f59e0b' },
  { icon: '⏱️', title: 'Pomodoro Timer', desc: 'Teknik belajar fokus 25 menit yang terbukti efektif secara ilmiah.', color: '#ef4444' },
  { icon: '📄', title: 'Ringkasan PDF AI', desc: 'Upload materi PDF dan dapatkan ringkasan otomatis dari AI dalam detik.', color: '#6366f1' },
  { icon: '🏆', title: 'Leaderboard & Poin', desc: 'Bersaing sehat dengan teman. Kumpulkan poin dan jaga streak harianmu.', color: '#f59e0b' },
]

const STATS = [
  { value: '10K+', label: 'Pengguna Aktif' },
  { value: '500K+', label: 'Tugas Diselesaikan' },
  { value: '98%', label: 'Puas dengan Fitur' },
  { value: '4.9★', label: 'Rating Pengguna' },
]

const TESTIMONIALS = [
  { name: 'Rizky A.', role: 'Mahasiswa Teknik Informatika', text: 'AI Tutor-nya luar biasa! Bisa jawab soal algoritma kompleks dalam hitungan detik. Nilai UAS-ku naik drastis.', avatar: '👨‍💻' },
  { name: 'Sari W.', role: 'Mahasiswi Kedokteran', text: 'Flashcard + pomodoro timer = kombinasi sempurna buat hafalan anatomi. Udah gak bisa belajar tanpa StudyHub.', avatar: '👩‍⚕️' },
  { name: 'Dani P.', role: 'Mahasiswa Ekonomi', text: 'Fitur kelas virtualnya bikin koordinasi kelompok jadi jauh lebih gampang. Ga perlu WhatsApp group yang berantakan lagi.', avatar: '👨‍💼' },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function AnimatedCounter({ target }: { target: string }) {
  const { ref, inView } = useInView()
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (!inView) return
    const num = parseInt(target.replace(/\D/g, ''))
    if (isNaN(num)) { setDisplay(target); return }
    const suffix = target.replace(/[\d,]/g, '')
    let start = 0
    const step = Math.ceil(num / 40)
    const timer = setInterval(() => {
      start = Math.min(start + step, num)
      setDisplay(start.toLocaleString() + suffix)
      if (start >= num) clearInterval(timer)
    }, 35)
    return () => clearInterval(timer)
  }, [inView, target])
  return <span ref={ref}>{inView ? display : '0'}</span>
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'authenticated' && session) redirect('/dashboard')
  }, [status, session])

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
  }

  const featuresRef = useInView()
  const statsRef = useInView()
  const testimonialsRef = useInView()

  return (
    <div style={{ background: '#080b14', color: '#f8fafc', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(20px)', background: 'rgba(8,11,20,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff', boxShadow: '0 0 20px rgba(79,70,229,0.5)' }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', background: 'linear-gradient(135deg,#a5b4fc,#fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>StudyHub</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, textDecoration: 'none', padding: '8px 16px', borderRadius: 10, transition: 'color 0.2s' }}>Masuk</Link>
          <Link href="/auth/register" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', padding: '9px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(79,70,229,0.4)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            Mulai Gratis →
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} onMouseMove={handleMouseMove} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Animated gradient mesh background */}
        <div style={{ position: 'absolute', inset: 0, background: `
          radial-gradient(ellipse 80% 60% at ${mousePos.x}% ${mousePos.y}%, rgba(79,70,229,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 20%, rgba(124,58,237,0.15) 0%, transparent 50%),
          radial-gradient(ellipse 50% 40% at 20% 80%, rgba(14,165,233,0.12) 0%, transparent 50%)
        `, transition: 'background 0.3s ease', pointerEvents: 'none' }} />

        {/* Grid lines */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `, backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        {/* Floating orbs */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)', top: '-10%', right: '-5%', animation: 'floatOrb 8s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)', bottom: '5%', left: '-5%', animation: 'floatOrb 10s ease-in-out infinite reverse', pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.3)', borderRadius: 999, padding: '6px 16px', marginBottom: 28, backdropFilter: 'blur(10px)', animation: 'fadeSlideDown 0.6s ease both' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulseLive 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Platform belajar terbaik untuk mahasiswa Indonesia</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(36px, 7vw, 76px)', fontWeight: 900, lineHeight: 1.08, textAlign: 'center', margin: '0 0 20px', letterSpacing: '-0.03em', maxWidth: 860, animation: 'fadeSlideDown 0.7s ease 0.1s both' }}>
          Belajar Lebih Cerdas
          <br />
          <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #67e8f9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            dengan AI Pribadi
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, textAlign: 'center', maxWidth: 580, margin: '0 0 40px', animation: 'fadeSlideDown 0.7s ease 0.2s both' }}>
          Satu platform untuk semua kebutuhan kuliah — AI Tutor, tugas, catatan, kelas virtual, flashcard, dan lebih banyak lagi. Gratis selamanya.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeSlideDown 0.7s ease 0.3s both' }}>
          <Link href="/auth/register" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', padding: '16px 32px', borderRadius: 14, fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: '0 8px 32px rgba(79,70,229,0.5)', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(79,70,229,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(79,70,229,0.5)' }}>
            🚀 Mulai Gratis Sekarang
          </Link>
          <Link href="/auth/login" style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', padding: '16px 28px', borderRadius: 14, fontSize: 15, fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', transition: 'background 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}>
            Sudah punya akun →
          </Link>
        </div>

        {/* Trust indicators */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 24, animation: 'fadeSlideDown 0.7s ease 0.4s both' }}>
          ✓ Tidak perlu kartu kredit &nbsp;·&nbsp; ✓ Setup dalam 30 detik &nbsp;·&nbsp; ✓ Gratis selamanya
        </p>

        {/* App preview mockup */}
        <div style={{ marginTop: 64, width: '100%', maxWidth: 900, position: 'relative', animation: 'fadeSlideUp 0.9s ease 0.4s both' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.1))', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', padding: 24 }}>
            {/* Mock topbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ade80', opacity: 0.7 }} />
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 28, marginLeft: 12 }} />
            </div>
            {/* Mock dashboard content */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {[['📋', '12', 'Tugas Aktif', '#6366f1'], ['✅', '47', 'Selesai', '#10b981'], ['🔥', '14', 'Hari Streak', '#f59e0b'], ['⭐', '2.4K', 'Total Poin', '#8b5cf6']].map(([icon, val, label, color]) => (
                <div key={label as string} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 16px', border: `1px solid ${color}22` }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>📅 Tugas Mendatang</div>
                {['UTS Algoritma · Besok', 'Laporan Lab · 3 hari', 'Presentasi · Minggu ini'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))', borderRadius: 14, padding: 16, border: '1px solid rgba(79,70,229,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(165,180,252,0.9)', marginBottom: 8 }}>🤖 AI Tutor</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 12 }}>
                  &ldquo;Kamu punya 3 tugas deadline besok. Mau mulai dari mana?&rdquo;
                </div>
                <div style={{ background: 'rgba(79,70,229,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#a5b4fc', textAlign: 'center', fontWeight: 600 }}>
                  Chat sekarang →
                </div>
              </div>
            </div>
          </div>
          {/* Glow underneath */}
          <div style={{ position: 'absolute', bottom: -30, left: '10%', right: '10%', height: 60, background: 'linear-gradient(135deg,rgba(79,70,229,0.3),rgba(124,58,237,0.3))', borderRadius: '50%', filter: 'blur(30px)', zIndex: -1 }} />
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef.ref} style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ opacity: statsRef.inView ? 1 : 0, transform: statsRef.inView ? 'none' : 'translateY(20px)', transition: `all 0.6s ease ${i * 0.1}s` }}>
              <div style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, background: 'linear-gradient(135deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
                <AnimatedCounter target={s.value} />
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section ref={featuresRef.ref} style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 999, padding: '5px 16px', fontSize: 13, fontWeight: 700, color: '#a5b4fc', marginBottom: 16 }}>
            ✨ Semua yang kamu butuhkan
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Satu platform,{' '}
            <span style={{ background: 'linear-gradient(135deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              semua fitur
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, marginTop: 14, maxWidth: 520, margin: '14px auto 0' }}>
            Tidak perlu buka 10 tab. Semuanya ada di sini, terintegrasi dengan sempurna.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20, padding: '24px 20px',
                opacity: featuresRef.inView ? 1 : 0,
                transform: featuresRef.inView ? 'none' : 'translateY(30px)',
                transition: `all 0.6s ease ${i * 0.07}s`,
                cursor: 'default',
                backdropFilter: 'blur(10px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `rgba(${f.color === '#6366f1' ? '99,102,241' : f.color === '#8b5cf6' ? '139,92,246' : f.color === '#0ea5e9' ? '14,165,233' : f.color === '#10b981' ? '16,185,129' : f.color === '#f59e0b' ? '245,158,11' : '239,68,68'},0.08)`
                e.currentTarget.style.border = `1px solid ${f.color}30`
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = `0 20px 40px ${f.color}15`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section ref={testimonialsRef.ref} style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Kata mereka tentang{' '}
              <span style={{ background: 'linear-gradient(135deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                StudyHub
              </span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 24, opacity: testimonialsRef.inView ? 1 : 0, transform: testimonialsRef.inView ? 'none' : 'translateY(24px)', transition: `all 0.6s ease ${i * 0.12}s` }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{'★★★★★'}</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, margin: '12px 0 20px', fontStyle: 'italic' }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(79,70,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '120px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(79,70,229,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(30px, 5vw, 56px)', fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Siap belajar lebih{' '}
            <span style={{ background: 'linear-gradient(135deg,#818cf8,#c084fc,#67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              produktif?
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 17, margin: '0 0 40px', lineHeight: 1.7 }}>
            Bergabung gratis. Tidak perlu kartu kredit. Mulai dalam 30 detik.
          </p>
          <Link href="/auth/register"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', padding: '18px 44px', borderRadius: 16, fontSize: 17, fontWeight: 800, textDecoration: 'none', display: 'inline-block', boxShadow: '0 12px 40px rgba(79,70,229,0.5)', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(79,70,229,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 12px 40px rgba(79,70,229,0.5)' }}>
            Daftar Gratis Sekarang 🚀
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#fff' }}>S</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>StudyHub</span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()}</span>
          <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Terms of Service</Link>
          <Link href="/auth/login" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Masuk</Link>
          <Link href="/auth/register" style={{ fontSize: 13, color: '#a5b4fc', fontWeight: 700, textDecoration: 'none' }}>Daftar Gratis</Link>
        </div>
      </footer>

      {/* ── GLOBAL ANIMATIONS ── */}
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseLive {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        @media (max-width: 768px) {
          nav { padding: 14px 16px; }
          section { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
    </div>
  )
}
