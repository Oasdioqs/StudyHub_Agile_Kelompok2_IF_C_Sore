'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface OnboardingModalProps {
  onComplete: () => void
}

const STEPS = [
  { id: 'welcome', emoji: '👋', title: 'Selamat datang!' },
  { id: 'profile', emoji: '🎓', title: 'Tentang Kamu' },
  { id: 'features', emoji: '🚀', title: 'Apa yang bisa kamu lakukan' },
  { id: 'done', emoji: '🎉', title: 'Siap belajar!' },
]

const FEATURES = [
  { icon: 'bi-check2-square', label: 'Tugas', desc: 'Kelola semua tugasmu dengan deadline & prioritas' },
  { icon: 'bi-journal-text', label: 'Catatan', desc: 'Tulis catatan Markdown dengan auto-save' },
  { icon: 'bi-people-fill', label: 'Kelas', desc: 'Gabung atau buat kelas dengan teman-teman' },
  { icon: 'bi-robot', label: 'AI Tutor', desc: 'Tanya AI kapanpun saat belajar' },
  { icon: 'bi-card-heading', label: 'Flashcard', desc: 'Buat kartu belajar interaktif' },
  { icon: 'bi-timer', label: 'Timer', desc: 'Fokus belajar dengan Pomodoro timer' },
]

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { data: session } = useSession()
  const [step, setStep] = useState(0)
  const [institution, setInstitution] = useState('')
  const [major, setMajor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const firstName = session?.user?.name?.split(' ')[0] || 'Kamu'

  const handleFinish = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution, major }),
      })
    } finally {
      setSubmitting(false)
      onComplete()
    }
  }

  const handleSkip = async () => {
    await fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    onComplete()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        style={{
          background: 'var(--sh-card-bg, #fff)',
          borderRadius: 24,
          width: '100%', maxWidth: 480,
          boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          animation: 'scaleIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div style={{ padding: '28px 32px 28px' }}>
          {/* Step indicator — single progress dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  flex: 1, height: 4, borderRadius: 999,
                  background: i <= step ? '#4f46e5' : 'var(--sh-border, #e2e8f0)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>

          {/* Step content */}
          {step === 0 && (
            <div className="animate-fade-up" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--sh-text)', marginBottom: 8 }}>
                Halo, {firstName}!
              </h2>
              <p style={{ color: 'var(--sh-muted)', lineHeight: 1.7, margin: 0 }}>
                Selamat datang di <strong>StudyHub</strong> — platform belajar yang akan membantumu
                lebih produktif, terorganisir, dan menyenangkan.
              </p>
              <div style={{ marginTop: 24, padding: 16, background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', borderRadius: 14 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: '#4338ca', fontWeight: 600 }}>
                  Butuh kurang dari 1 menit untuk setup. Yuk mulai! 🎯
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-up">
              <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🎓</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--sh-text)', marginBottom: 4, textAlign: 'center' }}>
                Cerita sedikit tentang kamu
              </h2>
              <p style={{ color: 'var(--sh-muted)', fontSize: 13.5, textAlign: 'center', marginBottom: 20 }}>
                (Opsional — bisa diisi nanti di profil)
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--sh-text)', marginBottom: 6 }}>
                  Institusi / Universitas
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Contoh: Universitas Indonesia"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: '1.5px solid var(--sh-border, #e2e8f0)',
                    background: 'var(--sh-bg, #f8fafc)',
                    color: 'var(--sh-text)', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--sh-border, #e2e8f0)')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--sh-text)', marginBottom: 6 }}>
                  Jurusan / Program Studi
                </label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Contoh: Teknik Informatika"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: '1.5px solid var(--sh-border, #e2e8f0)',
                    background: 'var(--sh-bg, #f8fafc)',
                    color: 'var(--sh-text)', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#4f46e5')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--sh-border, #e2e8f0)')}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-up">
              <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🚀</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--sh-text)', marginBottom: 16, textAlign: 'center' }}>
                Ini yang bisa kamu lakukan
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    style={{
                      padding: '12px 14px', borderRadius: 12,
                      border: '1.5px solid var(--sh-border, #e2e8f0)',
                      background: 'var(--sh-bg, #f8fafc)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <i className={`bi ${f.icon}`} style={{ color: '#4f46e5', fontSize: 16 }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--sh-text)' }}>{f.label}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--sh-muted)', lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-up" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16, animation: 'successBounce 0.6s ease both' }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--sh-text)', marginBottom: 8 }}>
                Semua siap!
              </h2>
              <p style={{ color: 'var(--sh-muted)', lineHeight: 1.7, margin: '0 0 20px' }}>
                Akun kamu sudah siap. Mulai dengan menambahkan tugas pertama atau bergabung ke kelas.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 14px', background: '#eef2ff', borderRadius: 999, fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
                  <i className="bi bi-check-circle-fill me-1" />10 poin bonus untuk kamu!
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, gap: 10 }}>
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  background: 'none', border: '1.5px solid var(--sh-border)',
                  borderRadius: 12, padding: '10px 18px',
                  color: 'var(--sh-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ← Kembali
              </button>
            ) : (
              <button
                onClick={handleSkip}
                style={{ background: 'none', border: 'none', color: 'var(--sh-muted)', fontSize: 13, cursor: 'pointer', padding: '10px 4px' }}
              >
                Lewati semua
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  border: 'none', borderRadius: 12, padding: '11px 24px',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.3)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(79,70,229,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.3)' }}
              >
                Lanjut →
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={submitting}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', borderRadius: 12, padding: '11px 24px',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 6px 20px rgba(16,185,129,0.3)',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Menyimpan...' : 'Mulai Belajar! 🎯'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
