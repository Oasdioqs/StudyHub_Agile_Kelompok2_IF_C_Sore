'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

const FREE_FEATURES = [
  { icon: '✅', text: 'Tugas & deadline pribadi (unlimited)' },
  { icon: '✅', text: 'Jadwal mingguan' },
  { icon: '✅', text: 'AI Tutor (10 pesan/hari)' },
  { icon: '✅', text: 'Catatan digital (unlimited)' },
  { icon: '✅', text: 'Kelas & tugas kelompok (1 kelas)' },
  { icon: '✅', text: 'Flashcard & Pomodoro Timer' },
  { icon: '✅', text: 'Notifikasi reminder (2 interval)' },
  { icon: '✅', text: 'PDF AI (maks 3 file)' },
  { icon: '❌', text: 'PDF AI unlimited', muted: true },
  { icon: '❌', text: 'Kelas unlimited', muted: true },
  { icon: '❌', text: 'AI Tutor unlimited', muted: true },
  { icon: '❌', text: 'Reminder semua interval (1, 5, 10, 30, 60, 120 menit)', muted: true },
  { icon: '❌', text: 'Analitik detail 90 hari', muted: true },
  { icon: '❌', text: 'Badge Premium di profil', muted: true },
]

const PREMIUM_FEATURES = [
  { icon: '🚀', text: 'Semua fitur Free' },
  { icon: '📄', text: 'PDF AI unlimited — upload, rangkum, soal, tanya' },
  { icon: '🤖', text: 'AI Tutor pesan tak terbatas' },
  { icon: '👥', text: 'Bergabung & buat kelas tak terbatas' },
  { icon: '🔔', text: 'Reminder dengan semua interval (1–120 menit)' },
  { icon: '📊', text: 'Analitik progress detail 90 hari' },
  { icon: '⭐', text: 'Badge Premium di profil' },
  { icon: '⚡', text: 'Prioritas support' },
]

export default function UpgradePage() {
  const { data: session, update: updateSession } = useSession()
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (session?.user?.email) {
      setForm((f) => ({ ...f, email: session.user!.email ?? '', name: session.user!.name ?? '' }))
    }
    // Trigger session update agar dev premium langsung aktif tanpa re-login
    updateSession().then((s) => {
      setIsPremium((s?.user as any)?.isPremium ?? false)
    }).catch(() => {
      setIsPremium((session?.user as any)?.isPremium ?? false)
    })
  }, [session?.user?.email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // Kirim request via mailto atau simpan ke DB (simple: buka mailto)
    const subject = encodeURIComponent(`[StudyHub Premium] Request Upgrade - ${form.name}`)
    const body = encodeURIComponent(`Halo Admin,\n\nSaya ingin upgrade ke Premium.\n\nNama: ${form.name}\nEmail: ${form.email}\nCatatan: ${form.note || '-'}\n\nTerima kasih!`)
    window.open(`mailto:admin@studyhub.app?subject=${subject}&body=${body}`, '_blank')
    setTimeout(() => {
      setSubmitted(true)
      setSubmitting(false)
    }, 500)
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="page-transition" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 60px' }}>

          {/* Already Premium */}
          {isPremium && (
            <div>
              {/* Hero Premium */}
              <div
                className="text-center mb-5 py-5 px-4 rounded-4"
                style={{ background: 'linear-gradient(135deg,#78350f,#92400e,#b45309)', color: '#fff', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle,rgba(251,191,36,0.3),transparent)', top: -80, right: -60, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 64, marginBottom: 12 }}>⭐</div>
                  <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-1 rounded-pill" style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', fontSize: 12, color: '#fde68a' }}>
                    Akun Premium Aktif
                  </div>
                  <h3 className="fw-bold mb-2" style={{ color: '#fff' }}>Kamu adalah member Premium! 🎉</h3>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 420, margin: '0 auto' }}>
                    Semua fitur eksklusif sudah aktif di akunmu. Nikmati belajar tanpa batas!
                  </p>
                </div>
              </div>

              {/* Active perks */}
              <div className="row g-3 mb-4">
                {PREMIUM_FEATURES.map((f, i) => (
                  <div key={i} className="col-sm-6">
                    <div className="card h-100" style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
                      <div className="card-body d-flex align-items-center gap-3 py-3">
                        <span style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>{f.icon}</span>
                        <span style={{ fontSize: 13 }}>{f.text}</span>
                        <i className="bi bi-check-circle-fill text-success ms-auto" style={{ flexShrink: 0 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-3 flex-wrap justify-content-center">
                <Link href="/pdf-library" className="btn btn-warning fw-bold px-4" style={{ borderRadius: 12 }}>
                  <i className="bi bi-file-earmark-richtext me-2" />Buka PDF AI
                </Link>
                <Link href="/ai-tutor" className="btn btn-outline-warning fw-bold px-4" style={{ borderRadius: 12 }}>
                  <i className="bi bi-robot me-2" />AI Tutor Unlimited
                </Link>
                <Link href="/dashboard" className="btn btn-outline-secondary px-4" style={{ borderRadius: 12 }}>
                  <i className="bi bi-house me-2" />Dashboard
                </Link>
              </div>
            </div>
          )}

          {!isPremium && (
            <>
              {/* Hero */}
              <div
                className="text-center mb-5 py-5 px-4 rounded-4"
                style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', color: '#fff', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.4),transparent)', top: -100, right: -80, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.3),transparent)', bottom: -60, left: -40, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-1 rounded-pill"
                    style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', fontSize: 12, color: '#a5b4fc' }}
                  >
                    ⭐ StudyHub Premium
                  </div>
                  <h2 className="fw-bold mb-3" style={{ fontSize: 'clamp(24px, 5vw, 36px)' }}>
                    Belajar lebih cerdas,<br />tanpa batas
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, maxWidth: 480, margin: '0 auto 24px' }}>
                    Upgrade ke Premium dan akses semua fitur AI eksklusif — PDF AI, AI Tutor unlimited, dan banyak lagi.
                  </p>
                  <div className="d-inline-flex align-items-end gap-1">
                    <span style={{ fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Rp 20.000</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 4 }}>/bulan</span>
                  </div>
                  <div style={{ color: '#a5b4fc', fontSize: 12, marginTop: 4 }}>
                    Hemat 33% kalau bayar tahunan (Rp 160.000/tahun)
                  </div>
                </div>
              </div>

              {/* Comparison */}
              <div className="row g-4 mb-5">
                {/* Free */}
                <div className="col-md-6">
                  <div className="card h-100" style={{ borderRadius: 16 }}>
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--sh-card-bg)', border: '1px solid var(--sh-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎓</span>
                        <div>
                          <div className="fw-bold" style={{ fontSize: 16 }}>Gratis</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>Paket saat ini</div>
                        </div>
                        <span className="badge bg-secondary ms-auto" style={{ fontSize: 11 }}>Aktif</span>
                      </div>
                      <div className="mb-3" style={{ fontSize: 24, fontWeight: 800 }}>Rp 0<span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>/bulan</span></div>
                      <ul className="list-unstyled mb-0" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {FREE_FEATURES.map((f, i) => (
                          <li key={i} className="d-flex align-items-center gap-2" style={{ fontSize: 13, color: f.muted ? '#94a3b8' : 'var(--sh-text)' }}>
                            <span style={{ width: 18, flexShrink: 0 }}>{f.icon}</span>
                            {f.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Premium */}
                <div className="col-md-6">
                  <div
                    className="card h-100"
                    style={{ borderRadius: 16, border: '2px solid #6366f1', boxShadow: '0 20px 40px rgba(99,102,241,0.15)' }}
                  >
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⭐</span>
                        <div>
                          <div className="fw-bold" style={{ fontSize: 16 }}>Premium</div>
                          <div style={{ fontSize: 12, color: '#6366f1' }}>Semua fitur eksklusif</div>
                        </div>
                        <span
                          className="badge ms-auto"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 11 }}
                        >
                          Rekomendasi ⭐
                        </span>
                      </div>
                      <div className="mb-3" style={{ fontSize: 24, fontWeight: 800, color: '#818cf8' }}>
                        Rp 20.000<span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>/bulan</span>
                      </div>
                      <ul className="list-unstyled mb-0" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {PREMIUM_FEATURES.map((f, i) => (
                          <li key={i} className="d-flex align-items-center gap-2" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                            <span style={{ width: 18, flexShrink: 0 }}>{f.icon}</span>
                            {f.text}
                          </li>
                        ))}
                      </ul>
                      <button
                        className="btn w-100 mt-4 fw-bold"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, padding: '12px', fontSize: 15, border: 'none', boxShadow: '0 8px 20px rgba(99,102,241,0.35)' }}
                        onClick={() => document.getElementById('upgrade-form')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        Upgrade Sekarang →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="mb-5">
                <h5 className="fw-bold mb-3 text-center">Pertanyaan Umum</h5>
                <div className="d-flex flex-column gap-3">
                  {[
                    { q: 'Bagaimana cara pembayaran?', a: 'Saat ini pembayaran dilakukan via transfer bank atau e-wallet (GoPay/OVO/Dana). Setelah konfirmasi transfer, akun akan diupgrade dalam 1×24 jam.' },
                    { q: 'Apakah bisa di-cancel kapan saja?', a: 'Ya, Premium bersifat bulanan. Kamu bisa tidak memperpanjang kapan saja, dan akun akan kembali ke Free setelah periode berakhir.' },
                    { q: 'Data PDF saya aman?', a: 'Ya. Kami hanya menyimpan teks hasil ekstrak untuk keperluan AI. File PDF asli tidak disimpan di server kami.' },
                    { q: 'Fitur apa yang paling populer di Premium?', a: 'PDF AI Assistant — upload materi kuliah, AI langsung merangkum dan buat soal latihan otomatis.' },
                  ].map((item, i) => (
                    <div key={i} className="card" style={{ borderRadius: 12 }}>
                      <div className="card-body py-3">
                        <div className="fw-bold mb-1" style={{ fontSize: 14 }}>❓ {item.q}</div>
                        <div className="text-muted" style={{ fontSize: 13 }}>{item.a}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upgrade Form */}
              <div id="upgrade-form" className="card" style={{ borderRadius: 20, border: '2px solid #6366f1', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', padding: '20px 24px' }}>
                  <h5 className="fw-bold mb-1" style={{ color: '#fff' }}>⭐ Request Upgrade Premium</h5>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0 }}>
                    Isi form ini dan admin akan menghubungimu dalam 1×24 jam
                  </p>
                </div>
                <div className="card-body p-4">
                  {submitted ? (
                    <div className="text-center py-4">
                      <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
                      <h5 className="fw-bold mb-2">Request terkirim!</h5>
                      <p className="text-muted mb-4">
                        Admin akan menghubungimu dalam 1×24 jam untuk proses upgrade. Cek email kamu ya!
                      </p>
                      <Link href="/dashboard" className="btn btn-primary">
                        Kembali ke Dashboard
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="row g-3 mb-3">
                        <div className="col-sm-6">
                          <label className="form-label fw-semibold small">Nama Lengkap *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Nama kamu"
                            required
                          />
                        </div>
                        <div className="col-sm-6">
                          <label className="form-label fw-semibold small">Email Akun *</label>
                          <input
                            type="email"
                            className="form-control"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="email@contoh.com"
                            required
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold small">Pilih Paket</label>
                          <div className="d-flex gap-3 flex-wrap">
                            <label className="d-flex align-items-center gap-2 cursor-pointer" style={{ cursor: 'pointer' }}>
                              <input type="radio" name="plan" defaultChecked />
                              <span className="small">Bulanan — <strong>Rp 20.000/bulan</strong></span>
                            </label>
                            <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                              <input type="radio" name="plan" />
                              <span className="small">Tahunan — <strong>Rp 160.000/tahun</strong> <span className="badge bg-success" style={{ fontSize: 10 }}>Hemat 33%</span></span>
                            </label>
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold small">Catatan (opsional)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            placeholder="Misal: mau pakai untuk keperluan kuliah semester ini"
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3 flex-wrap">
                        <button
                          type="submit"
                          className="btn fw-bold px-4"
                          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 12, border: 'none', boxShadow: '0 8px 18px rgba(99,102,241,0.3)' }}
                          disabled={submitting}
                        >
                          {submitting
                            ? <><span className="spinner-border spinner-border-sm me-2" />Mengirim…</>
                            : '⭐ Kirim Request Upgrade'}
                        </button>
                        <span className="text-muted small">atau hubungi langsung via WhatsApp</span>
                        <a
                          href="https://wa.me/6281234567890?text=Halo%20admin%2C%20saya%20ingin%20upgrade%20ke%20Premium%20StudyHub"
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-success"
                          style={{ borderRadius: 10 }}
                        >
                          <i className="bi bi-whatsapp me-1" />WhatsApp Admin
                        </a>
                      </div>
                      <p className="text-muted small mt-3 mb-0">
                        🔒 Data kamu aman. Kami tidak akan spam email kamu.
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
