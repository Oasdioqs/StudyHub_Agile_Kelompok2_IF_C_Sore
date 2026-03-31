'use client'
import Link from 'next/link'

export default function ProfilePage() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '72vh' }}>
      <div className="text-center" style={{ maxWidth: 460 }}>
        {/* Icon */}
        <div className="mx-auto mb-4 d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: 88, height: 88,
            background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
            boxShadow: '0 16px 40px rgba(16,185,129,0.3)',
            animation: 'pulse-soft-green 2.5s ease-in-out infinite',
          }}>
          <i className="bi bi-person-circle text-white" style={{ fontSize: 36 }} />
        </div>

        <h1 className="fw-bold mb-2" style={{ fontSize: '1.6rem', color: 'var(--sh-text)' }}>
          Profil Saya
        </h1>

        <span className="badge px-3 py-2 mb-3 d-inline-flex align-items-center gap-1"
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: '#d97706',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 999,
            fontSize: 12,
          }}>
          <i className="bi bi-tools" />
          Sedang Dalam Pengembangan
        </span>

        <p className="mb-4" style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--sh-muted)' }}>
          Halaman profil dengan statistik belajar, foto profil, dan riwayat aktivitasmu
          sedang kami poles. Sabar ya, sebentar lagi! 🎯
        </p>

        {/* Feature list */}
        <div className="rounded-3 text-start p-3 mb-4"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px dashed rgba(16,185,129,0.25)' }}>
          <div className="fw-semibold mb-2" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sh-muted)' }}>
            Segera Hadir
          </div>
          {[
            { icon: 'bi-camera', text: 'Upload & edit foto profil' },
            { icon: 'bi-building', text: 'Info institusi & jurusan' },
            { icon: 'bi-graph-up', text: 'Statistik belajar & streak' },
            { icon: 'bi-shield-lock', text: 'Ubah password' },
          ].map((f, i) => (
            <div key={i} className="d-flex align-items-center gap-2 py-1">
              <i className={`bi ${f.icon}`} style={{ fontSize: 14, width: 20, color: '#10b981', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--sh-text)' }}>{f.text}</span>
            </div>
          ))}
        </div>

        <Link href="/dashboard"
          className="btn fw-semibold px-4 py-2 rounded-pill"
          style={{ background: 'linear-gradient(135deg,#10b981,#0ea5e9)', color: 'white', border: 'none' }}>
          <i className="bi bi-house me-2" />
          Kembali ke Dashboard
        </Link>
      </div>

      <style>{`
        @keyframes pulse-soft-green {
          0%, 100% { box-shadow: 0 16px 40px rgba(16,185,129,0.3); transform: scale(1); }
          50% { box-shadow: 0 20px 50px rgba(16,185,129,0.45); transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}
