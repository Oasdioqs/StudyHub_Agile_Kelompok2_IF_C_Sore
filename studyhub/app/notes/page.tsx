'use client'
import Link from 'next/link'

export default function NotesPage() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '72vh' }}>
      <div className="text-center" style={{ maxWidth: 460 }}>
        {/* Icon */}
        <div className="mx-auto mb-4 d-flex align-items-center justify-content-center rounded-circle"
          style={{
            width: 88, height: 88,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 16px 40px rgba(99,102,241,0.3)',
            animation: 'pulse-soft 2.5s ease-in-out infinite',
          }}>
          <i className="bi bi-journal-text text-white" style={{ fontSize: 36 }} />
        </div>

        <h1 className="fw-bold mb-2" style={{ fontSize: '1.6rem', color: 'var(--sh-text)' }}>
          Catatan Digital
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
          Fitur catatan digital dengan editor Markdown, auto-save, dan pencarian full-text
          sedang kami siapkan. Harap bersabar! 🚀
        </p>

        {/* Feature list */}
        <div className="rounded-3 text-start p-3 mb-4"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.2)' }}>
          <div className="fw-semibold mb-2" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sh-muted)' }}>
            Segera Hadir
          </div>
          {[
            { icon: 'bi-markdown', text: 'Editor Markdown dengan live preview' },
            { icon: 'bi-cloud-check', text: 'Auto-save setiap 30 detik' },
            { icon: 'bi-tags', text: 'Tag & kategorisasi catatan' },
            { icon: 'bi-search', text: 'Pencarian full-text' },
          ].map((f, i) => (
            <div key={i} className="d-flex align-items-center gap-2 py-1">
              <i className={`bi ${f.icon}`} style={{ fontSize: 14, width: 20, color: '#6366f1', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--sh-text)' }}>{f.text}</span>
            </div>
          ))}
        </div>

        <Link href="/dashboard"
          className="btn fw-semibold px-4 py-2 rounded-pill"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
          <i className="bi bi-house me-2" />
          Kembali ke Dashboard
        </Link>
      </div>

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 16px 40px rgba(99,102,241,0.3); transform: scale(1); }
          50% { box-shadow: 0 20px 50px rgba(99,102,241,0.45); transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}
