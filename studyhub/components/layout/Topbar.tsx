'use client'
// components/layout/Topbar.tsx
import { usePathname } from 'next/navigation'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'Manajemen Tugas',
  '/notes': 'Catatan Digital',
  '/forum': 'Forum Diskusi',
  '/ai-tutor': 'AI Tutor',
  '/timer': 'Pomodoro Timer',
  '/profile': 'Profil Saya',
}

export default function Topbar() {
  const pathname = usePathname()
  const title = titles[pathname] ?? 'StudyHub'

  return (
    <header className="bg-white border-bottom px-4 py-3 d-flex align-items-center justify-content-between sticky-top">
      <h5 className="mb-0 fw-semibold" style={{ color: '#1e293b' }}>{title}</h5>
      <div className="d-flex align-items-center gap-3">
        <button className="btn btn-sm btn-light position-relative" title="Notifikasi">
          <i className="bi bi-bell" style={{ fontSize: 18 }}></i>
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: 10 }}>
            3
          </span>
        </button>
        <a href="/ai-tutor" className="btn btn-sm btn-primary">
          <i className="bi bi-robot me-1"></i>
          Tanya AI
        </a>
      </div>
    </header>
  )
}
