'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState, useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const navItems = [
  { href: '/dashboard',   icon: 'bi-house-door',       label: 'Dashboard' },
  { href: '/tasks',       icon: 'bi-check2-square',    label: 'Tugas' },
  { href: '/calendar',    icon: 'bi-calendar3',        label: 'Kalender' },
  { href: '/kelas',       icon: 'bi-people',           label: 'Kelas' },
  { href: '/notes',       icon: 'bi-journal-text',     label: 'Catatan' },
  { href: '/forum',       icon: 'bi-chat-dots',        label: 'Forum Diskusi' },
  { href: '/flashcards',  icon: 'bi-card-list',        label: 'Flashcard' },
  { href: '/ai-tutor',    icon: 'bi-robot',            label: 'StudyHub AI' },
  { href: '/timer',       icon: 'bi-alarm',            label: 'Pomodoro Timer' },
  { href: '/leaderboard', icon: 'bi-trophy',           label: 'Leaderboard' },
  { href: '/analytics',   icon: 'bi-graph-up-arrow',  label: 'Analitik' },
  { href: '/profile',     icon: 'bi-person-circle',    label: 'Profil Saya' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch (e) { /* not native */ }
  }, [])

  const handleMenuToggle = useCallback(() => {
    triggerHaptic()
    setMoreOpen((v) => !v)
  }, [triggerHaptic])

  const handleMenuClose = useCallback(() => {
    triggerHaptic()
    setMoreOpen(false)
  }, [triggerHaptic])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
      await signOut({ redirect: false })
    } finally {
      if (typeof window !== 'undefined') window.location.replace('/auth/login')
      setLoggingOut(false)
    }
  }

  return (
    <>
      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile via CSS)
      ══════════════════════════════════════════ */}
      <aside className="app-sidebar d-flex flex-column p-3">
        {/* Logo */}
        <div className="d-flex align-items-center gap-2 mb-4 px-2">
          <Image
            src="/logo.svg"
            alt="StudyHub Logo"
            width={36}
            height={36}
            style={{ borderRadius: 10 }}
            priority
          />
          <span className="fw-bold fs-5 brand-text">StudyHub</span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="sidebar-nav desktop-nav flex-grow-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link d-flex align-items-center gap-2 ${pathname === item.href ? 'active' : ''}`}
            >
              <i className={`bi ${item.icon}`} />
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        {session?.user && (
          <div className="border-top pt-3 mt-2">
            <div className="d-flex align-items-center gap-2 px-2 mb-2">
              {session.user.image ? (
                <Image src={session.user.image} alt="avatar" width={34} height={34} className="rounded-circle" />
              ) : (
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white"
                  style={{ width: 34, height: 34, fontSize: 13, fontWeight: 600 }}>
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="user-meta" style={{ overflow: 'hidden' }}>
                <div className="fw-semibold text-truncate" style={{ fontSize: 13 }}>{session.user.name}</div>
                <div className="text-muted text-truncate" style={{ fontSize: 11 }}>{session.user.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn btn-sm btn-outline-secondary w-100"
              style={{ fontSize: 13 }}
            >
              <i className="bi bi-box-arrow-right me-1" />
              <span className="logout-label">{loggingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV (hidden on desktop via CSS)
          Standalone — di luar aside agar bisa `display:none` aside secara independen
      ══════════════════════════════════════════ */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <div className="mobile-nav-row">
          {/* Left: Dashboard + Tugas */}
          <div className="mobile-nav-group mobile-nav-group-left">
            <Link href={navItems[0].href} className={`nav-link ${pathname === navItems[0].href ? 'active' : ''}`} onClick={handleMenuClose}>
              <i className={`bi ${navItems[0].icon}`} />
              <span className="nav-label">{navItems[0].label}</span>
            </Link>
            <Link href={navItems[1].href} className={`nav-link ${pathname === navItems[1].href ? 'active' : ''}`} onClick={handleMenuClose}>
              <i className={`bi ${navItems[1].icon}`} />
              <span className="nav-label">{navItems[1].label}</span>
            </Link>
          </div>

          {/* Center spacer for FAB */}
          <div className="mobile-fab-spacer" aria-hidden />

          {/* Right: Forum + Profil */}
          <div className="mobile-nav-group mobile-nav-group-right">
            <Link href={navItems[5].href} className={`nav-link ${pathname === navItems[5].href ? 'active' : ''}`} onClick={handleMenuClose}>
              <i className={`bi ${navItems[5].icon}`} />
              <span className="nav-label">Forum</span>
            </Link>
            <Link href={navItems[11].href} className={`nav-link ${pathname === navItems[11].href ? 'active' : ''}`} onClick={handleMenuClose}>
              <i className={`bi ${navItems[11].icon}`} />
              <span className="nav-label">Profil</span>
            </Link>
          </div>
        </div>

        {/* FAB + Radial Menu */}
        <div className="mobile-fab-container">
          <div className={`radial-overlay ${moreOpen ? 'open' : ''}`} onClick={handleMenuClose} />

          <button className={`mobile-fab-btn ${moreOpen ? 'open' : ''}`} onClick={handleMenuToggle}>
            <i className={moreOpen ? 'bi bi-x-lg' : 'bi bi-grid-fill'} />
          </button>

          <div className={`radial-menu ${moreOpen ? 'open' : ''}`}>
            {[navItems[2], navItems[3], navItems[4], navItems[6], navItems[7], navItems[8], navItems[9], navItems[10]].map((item, idx) => {
              const angles = [-84, -60, -36, -12, 12, 36, 60, 84]
              const angle = angles[idx]
              let shortLabel = item.label
              if (shortLabel === 'StudyHub AI') shortLabel = 'AI Tutor'
              if (shortLabel === 'Leaderboard') shortLabel = 'Peringkat'
              if (shortLabel === 'Pomodoro Timer') shortLabel = 'Timer'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`radial-menu-item ${pathname === item.href ? 'active' : ''}`}
                  style={{ '--angle': `${angle}deg` } as React.CSSProperties}
                  onClick={handleMenuClose}
                >
                  <i className={`bi ${item.icon}`} />
                  <span className="radial-menu-label">{shortLabel}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
