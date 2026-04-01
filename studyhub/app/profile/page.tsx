'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type Profile = {
  id: string; name: string; email: string; image: string | null
  bio: string | null; institution: string | null; major: string | null
  points: number; streak: number; doneTasks: number; kelasCount: number
  _count: { tasks: number; notes: number; flashcardSets: number }
  notificationSetting: { taskReminders: number[]; scheduleReminders: number[] } | null
}

const INTERVALS = [
  { value: 120, label: '2 Jam' },
  { value: 60,  label: '1 Jam' },
  { value: 30,  label: '30 Menit' },
  { value: 10,  label: '10 Menit' },
  { value: 5,   label: '5 Menit' },
  { value: 1,   label: '1 Menit' },
]

function IntervalSelector({ selected, onChange, label }: {
  selected: number[], onChange: (v: number[]) => void, label: string
}) {
  const toggle = (v: number) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v].sort((a, b) => b - a))
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--sh-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            type="button"
            onClick={() => toggle(iv.value)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.18s ease',
              background: selected.includes(iv.value) ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'var(--sh-bg)',
              color: selected.includes(iv.value) ? '#fff' : 'var(--sh-muted)',
              border: selected.includes(iv.value) ? 'none' : '1.5px solid var(--sh-border)',
            }}
          >
            {selected.includes(iv.value) && <i className="bi bi-check-lg me-1" />}
            {iv.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit profile
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editMajor, setEditMajor] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Notif settings
  const [taskReminders, setTaskReminders] = useState<number[]>([120, 60])
  const [scheduleReminders, setScheduleReminders] = useState<number[]>([120, 60])
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState(false)
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default')
  const [isIOS, setIsIOS] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isIOSPWA, setIsIOSPWA] = useState(false)

  useEffect(() => {
    fetchProfile()
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent
      const ios = /iPad|iPhone|iPod/.test(ua)
      const mobile = /Mobi|Android/i.test(ua) || ios
      // iOS PWA: dibuka dari Home Screen (standalone mode)
      const iosPWA = ios && (
        (navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
      )
      setIsIOS(ios)
      setIsMobile(mobile)
      setIsIOSPWA(iosPWA)
      if (!('Notification' in window)) {
        // iOS Safari di browser biasa → Notification API tidak ada
        // Tapi kalau iOS, ini bukan "tidak support", melainkan perlu install PWA
        setNotifPermission(ios ? 'default' : 'unsupported')
      } else {
        setNotifPermission(Notification.permission as 'granted' | 'denied' | 'default')
      }
    }
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const d: Profile = await res.json()
        setProfile(d)
        setEditName(d.name)
        setEditBio(d.bio ?? '')
        setEditInstitution(d.institution ?? '')
        setEditMajor(d.major ?? '')
        if (d.notificationSetting) {
          setTaskReminders(d.notificationSetting.taskReminders)
          setScheduleReminders(d.notificationSetting.scheduleReminders)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, bio: editBio, institution: editInstitution, major: editMajor }),
      })
      if (res.ok) {
        setProfileSuccess(true)
        setTimeout(() => setProfileSuccess(false), 2500)
        fetchProfile()
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveNotif = async () => {
    setSavingNotif(true)
    try {
      await fetch('/api/user/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskReminders, scheduleReminders }),
      })
      setNotifSuccess(true)
      setTimeout(() => setNotifSuccess(false), 2500)
    } finally {
      setSavingNotif(false)
    }
  }

  const initials = profile?.name?.charAt(0).toUpperCase() ?? session?.user?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="pf-wrap">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[100, 200, 160].map((h, i) => (
            <div key={i} className="pf-sk" style={{ height: h, borderRadius: 20 }} />
          ))}
        </div>
      ) : !profile ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--sh-muted)' }}>Gagal memuat profil.</div>
      ) : (
        <>
          {/* ── Hero Card ── */}
          <div className="pf-hero">
            <div className="pf-avatar">{profile.image ? <img src={profile.image} alt={profile.name} /> : initials}</div>
            <div className="pf-hero-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 className="pf-name" style={{ margin: 0 }}>{profile.name}</h1>
                {(session?.user as any)?.isPremium && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'linear-gradient(135deg,#f59e0b,#f97316)',
                    color: '#fff', fontSize: 11, fontWeight: 800,
                    padding: '3px 10px', borderRadius: 999,
                    boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
                    letterSpacing: '0.03em',
                  }}>
                    ⭐ PREMIUM
                  </span>
                )}
              </div>
              <div className="pf-email"><i className="bi bi-envelope-fill me-1" />{profile.email}</div>
              {profile.institution && <div className="pf-sub"><i className="bi bi-building me-1" />{profile.institution}{profile.major && ` · ${profile.major}`}</div>}
              {profile.bio && <div className="pf-bio">{profile.bio}</div>}
              {(session?.user as any)?.isPremium && (
                <div style={{ marginTop: 8 }}>
                  <a href="/upgrade" style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>
                    <i className="bi bi-star-fill me-1" />Kelola Langganan Premium
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="pf-stats">
            {[
              { icon: 'bi-check-circle-fill', label: 'Tugas Selesai', value: profile.doneTasks, color: '#10b981' },
              { icon: 'bi-fire', label: 'Streak', value: `${profile.streak} hari`, color: '#f59e0b' },
              { icon: 'bi-trophy-fill', label: 'Poin', value: profile.points, color: '#4f46e5' },
              { icon: 'bi-mortarboard-fill', label: 'Kelas Diikuti', value: profile.kelasCount, color: '#3b82f6' },
              { icon: 'bi-file-earmark-text-fill', label: 'Catatan', value: profile._count.notes, color: '#8b5cf6' },
              { icon: 'bi-card-list', label: 'Flashcard Set', value: profile._count.flashcardSets, color: '#ec4899' },
            ].map((s) => (
              <div key={s.label} className="pf-stat-card">
                <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: '1.4rem', marginBottom: 6 }} />
                <div className="pf-stat-value">{s.value}</div>
                <div className="pf-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Edit Profil ── */}
          <div className="pf-card">
            <div className="pf-card-header">
              <i className="bi bi-person-fill" style={{ color: '#4f46e5' }} />
              <h2 className="pf-card-title">Edit Profil</h2>
            </div>
            <form onSubmit={handleSaveProfile} className="pf-form">
              <div className="pf-form-row">
                <div className="pf-form-group">
                  <label>Nama Lengkap <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama kamu..." required />
                </div>
                <div className="pf-form-group">
                  <label>Institusi / Universitas</label>
                  <input type="text" value={editInstitution} onChange={(e) => setEditInstitution(e.target.value)} placeholder="Nama universitas..." />
                </div>
              </div>
              <div className="pf-form-row">
                <div className="pf-form-group">
                  <label>Jurusan / Program Studi</label>
                  <input type="text" value={editMajor} onChange={(e) => setEditMajor(e.target.value)} placeholder="Jurusan kamu..." />
                </div>
                <div className="pf-form-group">
                  <label>Bio Singkat</label>
                  <input type="text" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Ceritakan tentang kamu..." />
                </div>
              </div>
              {profileSuccess && (
                <div className="pf-success-banner"><i className="bi bi-check-circle-fill me-2" />Profil berhasil disimpan!</div>
              )}
              <button type="submit" className="pf-btn-primary" disabled={savingProfile}>
                {savingProfile ? <><span className="pf-spin" /> Menyimpan...</> : <><i className="bi bi-check2 me-1" />Simpan Profil</>}
              </button>
            </form>
          </div>

          {/* ── Pengaturan Notifikasi Personal ── */}
          <div className="pf-card">
            <div className="pf-card-header">
              <i className="bi bi-bell-fill" style={{ color: '#f59e0b' }} />
              <div>
                <h2 className="pf-card-title">Pengaturan Notifikasi Personal</h2>
                <p className="pf-card-sub">Pilih kapan kamu ingin diingatkan untuk tugas dan jadwal <strong>pribadi</strong> kamu.</p>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <IntervalSelector
                label="⏰ Reminder Deadline Tugas Pribadi"
                selected={taskReminders}
                onChange={setTaskReminders}
              />
              <IntervalSelector
                label="📅 Reminder Jadwal Kuliah Pribadi"
                selected={scheduleReminders}
                onChange={setScheduleReminders}
              />
              {notifSuccess && (
                <div className="pf-success-banner"><i className="bi bi-check-circle-fill me-2" />Pengaturan notifikasi disimpan!</div>
              )}
              <button type="button" className="pf-btn-primary" onClick={handleSaveNotif} disabled={savingNotif}>
                {savingNotif ? <><span className="pf-spin" />Menyimpan...</> : <><i className="bi bi-bell me-1" />Simpan Pengaturan Notifikasi</>}
              </button>

              {/* Status Notifikasi */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--sh-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status Notifikasi Push</div>

                {notifPermission === 'granted' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 10 }}>
                    <i className="bi bi-check-circle-fill" style={{ color: '#10b981', fontSize: '1.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#059669' }}>Notifikasi Aktif ✓</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--sh-muted)', marginTop: 2 }}>Push notification akan dikirim ke device ini secara real-time.</div>
                    </div>
                  </div>
                )}

                {notifPermission === 'denied' && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.3)', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#dc2626', marginBottom: 8 }}>
                      <i className="bi bi-x-circle-fill me-2" />Notifikasi Diblokir — Perlu Diaktifkan Manual
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--sh-muted)', lineHeight: 1.7 }}>
                      {!isMobile ? (
                        // Desktop guide
                        <>
                          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--sh-text)' }}>Cara unblock di browser desktop:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                              { icon: '🔒', text: <>Klik ikon <strong>🔒</strong> atau <strong>ⓘ</strong> di kiri address bar (URL bar atas)</> },
                              { icon: '🔔', text: <>Cari <strong>Notifications</strong> / <strong>Notifikasi</strong> dalam daftar izin</> },
                              { icon: '✅', text: <>Ubah dari <strong style={{ color: '#dc2626' }}>Block</strong> menjadi <strong style={{ color: '#059669' }}>Allow</strong> / <strong style={{ color: '#059669' }}>Izinkan</strong></> },
                              { icon: '🔄', text: <>Klik tombol <strong>Refresh</strong> di bawah</> },
                            ].map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, border: '1px solid var(--sh-border)' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.icon}</span>
                                <span>{step.text}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : isIOS ? (
                        // iOS Settings guide
                        <>
                          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--sh-text)' }}>Cara unblock di iPhone/iPad:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                              { icon: '⚙️', text: <>Buka <strong>Pengaturan iPhone</strong></> },
                              { icon: '🧭', text: <>Gulir ke bawah → pilih <strong>Safari</strong></> },
                              { icon: '🔔', text: <>Pilih <strong>Notifikasi</strong> → aktifkan untuk <strong>studyhub</strong></> },
                              { icon: '🔄', text: <>Kembali ke app dan tap Refresh</> },
                            ].map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, border: '1px solid var(--sh-border)' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.icon}</span>
                                <span>{step.text}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        // Android Chrome guide
                        <>
                          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--sh-text)' }}>Cara unblock di Android Chrome:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                              { icon: '🔒', text: <>Tap ikon <strong>🔒</strong> di kiri address bar Chrome</> },
                              { icon: '📋', text: <>Pilih <strong>Izin Situs</strong> / <strong>Site Settings</strong></> },
                              { icon: '🔔', text: <>Tap <strong>Notifikasi</strong> → ubah ke <strong style={{ color: '#059669' }}>Izinkan</strong></> },
                              { icon: '🔄', text: <>Kembali dan tap Refresh di bawah</> },
                            ].map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, border: '1px solid var(--sh-border)' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.icon}</span>
                                <span>{step.text}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      style={{
                        marginTop: 12, padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700,
                        borderRadius: 999, border: '1.5px solid rgba(239,68,68,0.4)',
                        background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <i className="bi bi-arrow-clockwise" /> Refresh Setelah Unblock
                    </button>
                  </div>
                )}

                {notifPermission === 'default' && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#d97706', marginBottom: 6 }}><i className="bi bi-bell-slash-fill me-2" />Notifikasi Belum Diaktifkan</div>
                    {isIOS && !isIOSPWA ? (
                      // iOS di browser biasa — butuh install PWA dulu
                      <div style={{ fontSize: '0.8rem', color: 'var(--sh-muted)', lineHeight: 1.6 }}>
                        <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.07)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontWeight: 600 }}>
                          ⚠️ iPhone / iPad wajib install app ke Home Screen dulu
                        </div>
                        <strong>Cara install (hanya perlu 1x):</strong>
                        <ol style={{ marginTop: 6, paddingLeft: 16 }}>
                          <li>Buka StudyHub di <strong>Safari</strong> (wajib Safari, bukan Chrome/Firefox)</li>
                          <li>Tap ikon <strong>Share</strong> 🔗 (kotak panah ke atas, di bawah layar)</li>
                          <li>Gulir dan pilih <strong>"Add to Home Screen"</strong></li>
                          <li>Tap <strong>Add</strong> di pojok kanan atas</li>
                          <li>Buka app dari <strong>Home Screen</strong> (bukan dari Safari)</li>
                          <li>Izinkan notifikasi saat pop-up muncul ✅</li>
                        </ol>
                        <div style={{ marginTop: 8, fontSize: '0.75rem', opacity: 0.7 }}>
                          💡 Setelah install, app terasa seperti app native — ikon di home screen, full-screen, push notification aktif.
                        </div>
                      </div>
                    ) : isIOSPWA ? (
                      // iOS sudah di PWA mode — bisa request permission
                      <div style={{ fontSize: '0.8rem', color: 'var(--sh-muted)', lineHeight: 1.6, marginBottom: 10 }}>
                        Kamu sudah buka dari Home Screen ✅. Tap tombol di bawah untuk aktifkan notifikasi.
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--sh-muted)', lineHeight: 1.6, marginBottom: 10 }}>
                        Izinkan notifikasi agar reminder dikirim langsung ke device ini.
                      </div>
                    )}
                    {(!isIOS || isIOSPWA) && (
                      <button
                        type="button"
                        className="pf-btn-primary"
                        style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                        onClick={async () => {
                          if ('Notification' in window) {
                            const { requestAndRegisterToken } = await import('@/lib/firebase-client')
                            await requestAndRegisterToken()
                            setNotifPermission(Notification.permission as 'granted' | 'denied' | 'default')
                          }
                        }}
                      >
                        <i className="bi bi-bell-fill me-1" /> Aktifkan Notifikasi Sekarang
                      </button>
                    )}
                  </div>
                )}

                {notifPermission === 'unsupported' && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--sh-muted)', marginBottom: 4 }}><i className="bi bi-exclamation-triangle me-2" />Browser Tidak Support</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--sh-muted)' }}>Browser ini tidak mendukung push notification. Coba gunakan Chrome, Edge, atau Samsung Internet di Android.</div>
                  </div>
                )}

                <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--sh-muted)', opacity: 0.8 }}>
                  <i className="bi bi-info-circle me-1" />
                  Untuk pengaturan notifikasi <strong>kelas</strong>, komisaris mengaturnya di Pengaturan Kelas.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .pf-wrap { max-width: 780px; margin: 0 auto; padding: 16px 0 40px; display: flex; flex-direction: column; gap: 20px; }
        .pf-sk {
          background: linear-gradient(90deg, var(--sh-border) 25%, rgba(255,255,255,0.05) 50%, var(--sh-border) 75%);
          background-size: 200% 100%;
          animation: pf-shimmer 1.4s infinite ease-in-out;
        }
        @keyframes pf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .pf-hero {
          display: flex; align-items: center; gap: 20px;
          padding: 24px; border-radius: 24px;
          background: var(--sh-card-bg); border: 1px solid var(--sh-border);
          animation: pf-up 0.4s ease;
        }
        @keyframes pf-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .pf-avatar {
          width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 1.8rem; font-weight: 900; overflow: hidden;
        }
        .pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pf-hero-info { flex: 1; min-width: 0; }
        .pf-name { font-size: 1.4rem; font-weight: 900; color: var(--sh-text); margin: 0 0 4px; }
        .pf-email { font-size: 0.82rem; color: var(--sh-muted); margin-bottom: 4px; }
        .pf-sub { font-size: 0.8rem; color: var(--sh-muted); margin-bottom: 6px; }
        .pf-bio { font-size: 0.85rem; color: var(--sh-text); font-style: italic; }

        .pf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 560px) { .pf-stats { grid-template-columns: repeat(2, 1fr); } }
        .pf-stat-card {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 18px 12px; border-radius: 18px; text-align: center;
          background: var(--sh-card-bg); border: 1px solid var(--sh-border);
          animation: pf-up 0.4s ease;
        }
        .pf-stat-value { font-size: 1.4rem; font-weight: 900; color: var(--sh-text); }
        .pf-stat-label { font-size: 0.72rem; color: var(--sh-muted); font-weight: 600; margin-top: 2px; text-align: center; }

        .pf-card {
          background: var(--sh-card-bg); border: 1px solid var(--sh-border);
          border-radius: 20px; overflow: hidden; animation: pf-up 0.4s ease;
        }
        .pf-card-header {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 18px 20px 14px; border-bottom: 1px solid var(--sh-border);
          font-size: 1.1rem;
        }
        .pf-card-title { font-size: 1rem; font-weight: 800; color: var(--sh-text); margin: 0; }
        .pf-card-sub { font-size: 0.8rem; color: var(--sh-muted); margin: 3px 0 0; }

        .pf-form { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
        .pf-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .pf-form-row { grid-template-columns: 1fr; } }
        .pf-form-group { display: flex; flex-direction: column; gap: 6px; }
        .pf-form-group label { font-size: 0.8rem; font-weight: 700; color: var(--sh-muted); }
        .pf-form-group input {
          width: 100%; padding: 10px 14px; border-radius: 12px;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-bg); color: var(--sh-text);
          font-size: 0.9rem; transition: border-color 0.15s ease;
          font-family: inherit;
        }
        .pf-form-group input:focus { outline: none; border-color: #4f46e5; }

        .pf-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; border-radius: 999px; border: none;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease; align-self: flex-start;
        }
        .pf-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35); }
        .pf-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .pf-success-banner {
          display: flex; align-items: center;
          padding: 10px 16px; border-radius: 12px;
          background: rgba(16,185,129,0.1); color: #059669;
          border: 1px solid rgba(16,185,129,0.3); font-size: 0.85rem; font-weight: 600;
        }
        .pf-spin {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: white;
          border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
