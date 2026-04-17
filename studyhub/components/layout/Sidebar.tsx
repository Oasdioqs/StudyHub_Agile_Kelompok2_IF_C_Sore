'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useState, useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const navItems = [
  { href: '/dashboard',      icon: 'bi-house-door',            label: 'Dashboard' },
  { href: '/tasks',          icon: 'bi-check2-square',         label: 'Tugas' },
  { href: '/calendar',       icon: 'bi-calendar3',             label: 'Kalender' },
  { href: '/kelas',          icon: 'bi-people',                label: 'Kelas' },
  { href: '/notes',          icon: 'bi-journal-text',          label: 'Catatan' },
  { href: '/forum',          icon: 'bi-chat-dots',             label: 'Forum Diskusi' },
  { href: '/flashcards',     icon: 'bi-card-list',             label: 'Flashcard' },
  { href: '/ai-tutor',       icon: 'bi-robot',                 label: 'StudyHub AI' },
  { href: '/pdf-library',    icon: 'bi-file-earmark-richtext', label: 'Dokumen AI',       badge: 'Premium' },
  { href: '/video-summary',  icon: 'bi-play-circle',           label: 'Video AI',         badge: 'Beta' },
  { href: '/timer',          icon: 'bi-alarm',                 label: 'Pomodoro Timer' },
  { href: '/leaderboard',    icon: 'bi-trophy',                label: 'Leaderboard' },
  { href: '/analytics',      icon: 'bi-graph-up-arrow',        label: 'Analitik' },
  { href: '/upgrade',        icon: 'bi-star-fill',             label: 'Upgrade Premium',  badge: '⭐' },
  { href: '/profile',        icon: 'bi-person-circle',         label: 'Profil Saya' },
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
              prefetch={false}
              className={`nav-link d-flex align-items-center gap-2 ${pathname === item.href ? 'active' : ''}`}
            >
              <i className={`bi ${item.icon}`} />
              <span className="nav-label">{item.label}</span>
              {(item as any).badge && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#fff', borderRadius: 999, padding: '1px 5px', marginLeft: 'auto', flexShrink: 0, lineHeight: 1.6, letterSpacing: '0.04em',
                  background: (item as any).badge === 'Beta'
                    ? 'linear-gradient(135deg,#f59e0b,#f97316)'
                    : (item as any).badge === '⭐'
                      ? 'linear-gradient(135deg,#f59e0b,#f97316)'
                      : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                }}>
                  {(item as any).badge === 'Beta' ? 'BETA' : (item as any).badge === 'Premium' ? 'PRO' : (item as any).badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User info + logout */}
        {session?.user && (
          <div className="border-top pt-3 mt-2">
            {/* Premium badge strip */}
            {(session.user as any).isPremium && (
              <div
                className="d-flex align-items-center gap-2 px-2 py-1 mb-2 rounded-3"
                style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(249,115,22,0.1))', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <span style={{ fontSize: 14 }}>⭐</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Premium Member</span>
              </div>
            )}
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
          MOBILE BOTTOM NAV — 2 Layer System
          Layer 1: Bar bawah tetap (5 item)
          Layer 2: Tray slide-up (item lainnya)
      ══════════════════════════════════════════ */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">

        {/* ── Layer 2: backdrop overlay ── */}
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1036,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)',
            opacity: moreOpen ? 1 : 0,
            pointerEvents: moreOpen ? 'auto' : 'none',
            transition: 'opacity 0.22s ease',
          }}
          onClick={handleMenuClose}
        />

        {/* ── Layer 2: slide-up tray — anchored bottom:0, slides fully off-screen when closed ── */}
        <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            zIndex: 1038,
            transform: moreOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.28s cubic-bezier(0.34,1.2,0.64,1)',
            background: 'var(--sh-card-bg)',
            borderTop: '1px solid var(--sh-border)',
            borderRadius: '20px 20px 0 0',
            // padding-bottom harus cukup untuk nav bar (≈64px) + safe area
            padding: '14px 12px 0',
            paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
            willChange: 'transform',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--sh-border)', margin: '0 auto 14px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 4px' }}>
            {[
              navItems[2],  // Kalender
              navItems[3],  // Kelas
              navItems[4],  // Catatan
              navItems[5],  // Forum
              navItems[6],  // Flashcard
              navItems[10], // Timer
              navItems[11], // Leaderboard
              navItems[12], // Analitik
              navItems[8],  // Dokumen AI
              navItems[9],  // Video AI
              navItems[7],  // AI Tutor
              navItems[13], // Upgrade Premium
            ].map((item) => {
              let shortLabel = item.label
              if (shortLabel === 'StudyHub AI') shortLabel = 'AI Tutor'
              if (shortLabel === 'Leaderboard') shortLabel = 'Peringkat'
              if (shortLabel === 'Pomodoro Timer') shortLabel = 'Timer'
              if (shortLabel === 'Forum Diskusi') shortLabel = 'Forum'
              if (shortLabel === 'Dokumen AI') shortLabel = 'Dokumen'
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={handleMenuClose}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 4px',
                    borderRadius: 14,
                    textDecoration: 'none',
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 13,
                    background: isActive ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--sh-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <i className={`bi ${item.icon}`} style={{ fontSize: 18, color: isActive ? '#fff' : 'var(--sh-muted)' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#6366f1' : 'var(--sh-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                    {shortLabel}
                    {(item as any).badge && (
                      <span style={{ display: 'block', fontSize: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderRadius: 99, padding: '0 3px', marginTop: 1 }}>
                        PRO
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Layer 1: Fixed bottom bar ── */}
        <div className="mobile-nav-row">
          {/* Home */}
          <Link href={navItems[0].href} prefetch={false} className={`nav-link ${pathname === navItems[0].href ? 'active' : ''}`} onClick={handleMenuClose}>
            <i className={`bi ${navItems[0].icon}`} />
            <span className="nav-label">{navItems[0].label}</span>
          </Link>
          {/* Tugas */}
          <Link href={navItems[1].href} prefetch={false} className={`nav-link ${pathname === navItems[1].href ? 'active' : ''}`} onClick={handleMenuClose}>
            <i className={`bi ${navItems[1].icon}`} />
            <span className="nav-label">{navItems[1].label}</span>
          </Link>

          {/* Center: More button */}
          <button
            className={`mobile-fab-btn ${moreOpen ? 'open' : ''}`}
            onClick={handleMenuToggle}
            style={{ flexShrink: 0 }}
          >
            <i className={moreOpen ? 'bi bi-x-lg' : 'bi bi-grid-fill'} />
          </button>

          {/* AI Tutor */}
          <Link href={navItems[7].href} prefetch={false} className={`nav-link ${pathname === navItems[7].href ? 'active' : ''}`} onClick={handleMenuClose}>
            <i className={`bi ${navItems[7].icon}`} />
            <span className="nav-label">AI</span>
          </Link>
          {/* Profil */}
          <Link href="/profile" prefetch={false} className={`nav-link ${pathname === '/profile' ? 'active' : ''}`} onClick={handleMenuClose}>
            <i className="bi bi-person-circle" />
            <span className="nav-label">Profil</span>
          </Link>
        </div>

      </nav>
    </>
  )
}
