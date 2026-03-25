'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard',  icon: 'bi-house-door',       label: 'Dashboard' },
  { href: '/tasks',      icon: 'bi-check2-square',    label: 'Tugas' },
  { href: '/notes',      icon: 'bi-journal-text',     label: 'Catatan' },
  { href: '/forum',      icon: 'bi-chat-dots',        label: 'Forum Diskusi' },
  { href: '/ai-tutor',   icon: 'bi-robot',            label: 'StudyHub AI' },
  { href: '/timer',      icon: 'bi-alarm',            label: 'Pomodoro Timer' },
  { href: '/profile',    icon: 'bi-person-circle',    label: 'Profil Saya' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="app-sidebar d-flex flex-column p-3">
      {/* Logo */}
      <div className="d-flex align-items-center gap-2 mb-4 px-2">
        <div className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 36, height: 36, background: '#4f46e5' }}>
          <i className="bi bi-book-half text-white" style={{ fontSize: 16 }}></i>
        </div>
        <span className="fw-bold fs-5" style={{ color: '#1e293b' }}>StudyHub</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav flex-grow-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link d-flex align-items-center gap-2 ${pathname === item.href ? 'active' : ''}`}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User section */}
      {session?.user && (
        <div className="border-top pt-3 mt-2">
          <div className="d-flex align-items-center gap-2 px-2 mb-2">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="avatar"
                width={34}
                height={34}
                className="rounded-circle"
              />
            ) : (
              <div className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white"
                style={{ width: 34, height: 34, fontSize: 13, fontWeight: 600 }}>
                {session.user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div className="fw-semibold text-truncate" style={{ fontSize: 13 }}>
                {session.user.name}
              </div>
              <div className="text-muted text-truncate" style={{ fontSize: 11 }}>
                {session.user.email}
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="btn btn-sm btn-outline-secondary w-100"
            style={{ fontSize: 13 }}
          >
            <i className="bi bi-box-arrow-right me-1"></i>
            Keluar
          </button>
        </div>
      )}
    </aside>
  )
}
