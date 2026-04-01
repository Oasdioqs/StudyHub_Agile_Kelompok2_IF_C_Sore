'use client'
import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)} detik lalu`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
  return `${Math.floor(diffInSeconds / 86400)} hari lalu`;
}

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'Manajemen Tugas',
  '/calendar': 'Kalender Belajar',
  '/notes': 'Catatan Digital',
  '/forum': 'Forum Diskusi',
  '/ai-tutor': 'Chat dengan AI',
  '/timer': 'Pomodoro Timer',
  '/profile': 'Profil Saya',
}

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', desc: 'Ringkasan progres belajar harian' },
  { href: '/tasks', label: 'Tugas', desc: 'Kelola daftar tugas dan deadline' },
  { href: '/calendar', label: 'Kalender', desc: 'Lihat jadwal tugas per tanggal' },
  { href: '/notes', label: 'Catatan', desc: 'Lihat dan kelola catatan belajar' },
  { href: '/forum', label: 'Forum', desc: 'Diskusi dan tanya jawab komunitas' },
  { href: '/ai-tutor', label: 'AI Tutor', desc: 'Tanya soal dan belajar bareng AI' },
  { href: '/timer', label: 'Pomodoro Timer', desc: 'Mulai sesi fokus belajar' },
  { href: '/profile', label: 'Profil', desc: 'Atur profil dan preferensi akun' },
]

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isTasksPage = pathname === '/tasks'
  const isCalendarPage = pathname === '/calendar'
  const title = titles[pathname] ?? 'StudyHub'
  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? ''
  const priority = searchParams.get('priority') ?? ''
  const [keyword, setKeyword] = useState(q)
  const [showMenuSearch, setShowMenuSearch] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [bellBounce, setBellBounce] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef(0)
  const notifBusyRef = useRef(false)
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const updateTaskFilter = (key: 'status' | 'priority', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ''}`)
  }

  useEffect(() => {
    const fetchNotifs = async (force = false) => {
      if (notifBusyRef.current && !force) return
      if (!force && typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      notifBusyRef.current = true
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.notifications) return
        setNotifications(data.notifications)
        const newCount = data.unreadCount || 0
        if (newCount > prevUnreadRef.current) {
          setBellBounce(true)
          setTimeout(() => setBellBounce(false), 1500)
        }
        prevUnreadRef.current = newCount
        setUnreadCount(newCount)
      } finally {
        notifBusyRef.current = false
      }
    }

    void fetchNotifs(true)

    // Real-time polling: 15s saat visible, 60s saat hidden
    const startPolling = () => {
      if (notifIntervalRef.current) clearInterval(notifIntervalRef.current)
      const hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible'
      notifIntervalRef.current = setInterval(() => void fetchNotifs(), hidden ? 60_000 : 15_000)
    }
    startPolling()

    const onVisible = () => {
      void fetchNotifs()
      startPolling() // restart dengan interval yg sesuai
    }
    const handleNewNotif = () => setTimeout(() => void fetchNotifs(true), 600)

    window.addEventListener('studyhub:new-notification', handleNewNotif)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (notifIntervalRef.current) clearInterval(notifIntervalRef.current)
      window.removeEventListener('studyhub:new-notification', handleNewNotif)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenNotifs = () => {
    const opening = !showNotifs
    setShowNotifs(opening)
    if (opening && unreadCount > 0) {
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
      setUnreadCount(0)
      prevUnreadRef.current = 0
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    }
  }

  const handleDeleteNotif = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {})
    setNotifications([])
    setUnreadCount(0)
    prevUnreadRef.current = 0
    setDeletingAll(false)
  }

  const getNotifIcon = (type: string) => {
    const map: Record<string, { icon: string; color: string }> = {
      REMINDER: { icon: 'bi-alarm-fill', color: '#f59e0b' },
      TASK: { icon: 'bi-check2-square', color: '#6366f1' },
      CLASS: { icon: 'bi-people-fill', color: '#3b82f6' },
      SCHEDULE: { icon: 'bi-calendar-check-fill', color: '#10b981' },
      SYSTEM: { icon: 'bi-info-circle-fill', color: '#64748b' },
      ANNOUNCEMENT: { icon: 'bi-megaphone-fill', color: '#ec4899' },
    }
    return map[type] ?? { icon: 'bi-bell-fill', color: '#6366f1' }
  }

  const searchLower = normalizeText(keyword.trim())
  const menuSuggestions = !isTasksPage && searchLower
    ? menuItems
        .map((item) => {
          const label = normalizeText(item.label)
          const words = label.split(/\s+/).filter(Boolean)
          const startsWithLabel = label.startsWith(searchLower)
          const startsWithWord = words.some((w) => w.startsWith(searchLower))
          const includesLabel = label.includes(searchLower)
          const score = startsWithLabel ? 0 : startsWithWord ? 1 : includesLabel ? 2 : 99
          return { item, score }
        })
        .filter((x) => x.score < 99)
        .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label))
        .map((x) => x.item)
    : []
  const aiFallbackSuggestion =
    !isTasksPage && searchLower && menuSuggestions.length === 0
      ? {
          href: `/ai-tutor?ask=${encodeURIComponent(
            isCalendarPage
              ? `Bantu rangkumin kalender dan jadwal saya untuk konteks ini: ${keyword.trim()}`
              : keyword.trim(),
          )}`,
          label: 'Chat dengan AI',
          desc: isCalendarPage
            ? `Analisis kalender: "${keyword.trim()}"`
            : `Tanya langsung: "${keyword.trim()}"`,
        }
      : null

  useEffect(() => {
    setKeyword(q)
  }, [q])

  useEffect(() => {
    if (!isTasksPage) return
    if (keyword.trim() === q.trim()) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      const next = keyword.trim()
      if (next) params.set('q', next)
      else params.delete('q')
      const nextUrl = `/tasks${params.toString() ? `?${params.toString()}` : ''}`
      router.replace(nextUrl)
    }, 300)
    return () => clearTimeout(timer)
  }, [isTasksPage, keyword, q, router, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedTheme = window.localStorage.getItem('studyhub-theme')
    const preferDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const dark = savedTheme ? savedTheme === 'dark' : Boolean(preferDark)
    setIsDark(dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('studyhub-theme', next ? 'dark' : 'light')
    }
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  return (
    <header className="topbar-modern sticky-top">
      <div className="topbar-left">
        <div className="d-flex align-items-center gap-2 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="StudyHub" style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0 }} />
          <p className="topbar-caption mb-0">StudyHub Workspace</p>
        </div>
        <h5 className="mb-0 fw-semibold topbar-title">{title}</h5>
      </div>

      <div className="topbar-center">
        <div className="topbar-search-layer">
          <div className="topbar-search-wrap">
            <i className="bi bi-search topbar-search-icon"></i>
            <input
              className="topbar-search-input"
              placeholder={
                isTasksPage
                  ? 'Cari judul tugas...'
                  : isCalendarPage
                    ? 'Contoh: rangkumin bulan ini...'
                    : 'Cari nama menu...'
              }
              aria-label="Cari"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => setShowMenuSearch(true)}
              onBlur={() => setTimeout(() => setShowMenuSearch(false), 120)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (isTasksPage) return
                if (menuSuggestions.length > 0) {
                  router.push(menuSuggestions[0].href)
                } else if (aiFallbackSuggestion) {
                  router.push(aiFallbackSuggestion.href)
                }
              }}
            />
          </div>
          {!isTasksPage && showMenuSearch && (menuSuggestions.length > 0 || aiFallbackSuggestion) && (
            <div className="topbar-suggestion-list">
              {menuSuggestions.slice(0, 6).map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className="topbar-suggestion-item"
                  onMouseDown={() => router.push(item.href)}
                >
                  <div className="topbar-suggestion-title">{item.label}</div>
                  <div className="topbar-suggestion-desc">{item.desc}</div>
                </button>
              ))}
              {aiFallbackSuggestion && (
                <button
                  type="button"
                  className="topbar-suggestion-item"
                  onMouseDown={() => router.push(aiFallbackSuggestion.href)}
                >
                  <div className="topbar-suggestion-title">{aiFallbackSuggestion.label}</div>
                  <div className="topbar-suggestion-desc">{aiFallbackSuggestion.desc}</div>
                </button>
              )}
            </div>
          )}
        </div>
        {isTasksPage && (
          <div className="topbar-filters">
            <select
              className="topbar-filter-select"
              value={status}
              onChange={(e) => updateTaskFilter('status', e.target.value)}
              aria-label="Filter status tugas"
            >
              <option value="">Semua Status</option>
              <option value="TODO">Belum Mulai</option>
              <option value="IN_PROGRESS">Sedang Dikerjakan</option>
              <option value="DONE">Selesai</option>
            </select>
            <select
              className="topbar-filter-select"
              value={priority}
              onChange={(e) => updateTaskFilter('priority', e.target.value)}
              aria-label="Filter prioritas tugas"
            >
              <option value="">Semua Prioritas</option>
              <option value="HIGH">Tinggi</option>
              <option value="MEDIUM">Sedang</option>
              <option value="LOW">Rendah</option>
            </select>
          </div>
        )}
      </div>

      <div className="topbar-right">
        <Link
          href="/calendar"
          className="btn btn-sm topbar-icon-btn"
          title="Buka kalender"
          aria-label="Buka kalender"
        >
          <i className="bi bi-calendar3" style={{ fontSize: 16 }}></i>
        </Link>
        <button
          type="button"
          className="btn btn-sm topbar-icon-btn"
          title={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
          aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
          onClick={toggleTheme}
        >
          <i className={`bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`} style={{ fontSize: 16 }}></i>
        </button>
        <Link
          href="/tasks?action=new"
          className="btn btn-sm topbar-action-btn"
          aria-label="Buat tugas baru"
          title="Buat tugas baru"
        >
          <i className="bi bi-plus-lg me-1" aria-hidden></i>
          <span className="topbar-btn-text-full">Tugas</span>
        </Link>
        <Link
          href="/ai-tutor"
          className="btn btn-sm btn-primary"
          aria-label="Chat dengan AI"
          title="Tanya AI"
        >
          <i className="bi bi-robot me-1" aria-hidden></i>
          <span className="topbar-btn-text-full">Tanya AI</span>
        </Link>
        <div className="position-relative" ref={notifRef}>
          <button
            className={`btn btn-sm topbar-icon-btn position-relative${bellBounce ? ' bell-bounce' : ''}`}
            title="Notifikasi"
            onClick={handleOpenNotifs}
          >
            <i className={`bi ${unreadCount > 0 ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: 17 }} />
            {unreadCount > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill border border-2"
                style={{ fontSize: 10, background: 'linear-gradient(135deg,#ef4444,#dc2626)', borderColor: 'var(--sh-card-bg) !important' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <style>{`
            @keyframes bellShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(14deg)} 40%{transform:rotate(-14deg)} 60%{transform:rotate(8deg)} 80%{transform:rotate(-8deg)} }
            .bell-bounce i { animation: bellShake 0.6s ease 2; }
            @keyframes notifSlideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
            .notif-popup { animation: notifSlideIn 0.18s ease; }
            .notif-item:hover { background: var(--sh-hover) !important; }
            .notif-item-del { opacity:0; transition: opacity 0.15s; }
            .notif-item:hover .notif-item-del { opacity:1; }
          `}</style>

          {showNotifs && (
            <div
              className="notif-popup shadow-lg"
              style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: 360, padding: 0, borderRadius: 18,
                background: 'var(--sh-card-bg)',
                border: '1px solid var(--sh-border)',
                zIndex: 1050, overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--sh-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-bell-fill" style={{ color: '#6366f1', fontSize: 15 }} />
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Notifikasi</span>
                {unreadCount > 0 && (
                  <span style={{ background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 7px' }}>
                    {unreadCount} baru
                  </span>
                )}
                <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                  {notifications.length > 0 && (
                    <button
                      className="btn btn-sm"
                      title="Hapus semua"
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                      onClick={handleDeleteAll}
                      disabled={deletingAll}
                    >
                      {deletingAll ? <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} /> : <><i className="bi bi-trash3 me-1" />Hapus Semua</>}
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, color: 'var(--sh-muted)', border: '1px solid var(--sh-border)' }}
                    onClick={() => setShowNotifs(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--sh-muted)' }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Tidak ada notifikasi</div>
                    <div style={{ fontSize: 12 }}>Semua aktivitas akan muncul di sini</div>
                  </div>
                ) : (
                  notifications.map((n) => {
                    let navLink = n.link || '/'
                    if (navLink.startsWith('reminder:task:')) navLink = '/tasks'
                    else if (navLink.startsWith('reminder:schedule:')) navLink = '/calendar'
                    else if (navLink.startsWith('class-task-reminder:')) navLink = '/kelas'
                    else if (navLink.startsWith('class-schedule-reminder:')) navLink = '/kelas'
                    const { icon, color } = getNotifIcon(n.type)
                    return (
                      <div
                        key={n.id}
                        className="notif-item"
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '11px 14px',
                          borderBottom: '1px solid var(--sh-border)',
                          cursor: 'pointer',
                          background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.06)',
                          position: 'relative',
                        }}
                        onClick={() => { setShowNotifs(false); router.push(navLink) }}
                      >
                        {/* Type icon */}
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`bi ${icon}`} style={{ color, fontSize: 15 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--sh-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.title}</span>
                            {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--sh-muted)', lineHeight: 1.4, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: 'var(--sh-muted)', opacity: 0.7 }}>{timeAgo(n.createdAt)}</div>
                        </div>
                        {/* Delete single */}
                        <button
                          className="notif-item-del btn btn-sm"
                          style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, color: '#94a3b8', flexShrink: 0, position: 'absolute', top: 10, right: 10 }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteNotif(n.id) }}
                          title="Hapus"
                        >
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--sh-border)', textAlign: 'center' }}>
                  <Link href="/profile" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 600 }} onClick={() => setShowNotifs(false)}>
                    Lihat semua di Preferensi →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="dropdown">
          <button 
            className="topbar-avatar border-0 p-0 shadow-sm" 
            title="Profil & Preferensi" 
            data-bs-toggle="dropdown" 
            aria-expanded="false"
            style={{ 
              width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white'
            }}
          >
            <i className="bi bi-person-fill" style={{ fontSize: '18px' }}></i>
          </button>
          <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 mt-2 p-2" style={{ borderRadius: '16px', minWidth: '220px', zIndex: 1050, background: 'var(--sh-card-bg)' }}>
            <li className="px-3 py-2 mb-1">
              <div className="fw-bold" style={{ fontSize: '14px', color: 'var(--sh-text)' }}>Akun Saya</div>
              <div className="text-secondary text-truncate" style={{ fontSize: '12px' }}>Pengguna StudyHub</div>
            </li>
            <li><hr className="dropdown-divider mb-1 mt-0" /></li>
            <li><Link href="/profile" className="dropdown-item py-2 fw-semibold rounded-3 mb-1" style={{ fontSize: '13px', color: 'var(--sh-text)' }}><i className="bi bi-person-circle me-2 text-primary"></i>Profil Utama</Link></li>
            <li><button className="dropdown-item py-2 fw-semibold rounded-3 mb-1" style={{ fontSize: '13px', color: 'var(--sh-text)' }} onClick={toggleTheme}><i className={`bi ${isDark ? 'bi-sun-fill text-warning' : 'bi-moon-stars-fill text-secondary'} me-2`}></i>{isDark ? 'Mode Terang' : 'Mode Gelap'}</button></li>
            <li><Link href="/profile" className="dropdown-item py-2 fw-semibold rounded-3 mb-1" style={{ fontSize: '13px', color: 'var(--sh-text)' }}><i className="bi bi-gear-fill me-2 text-secondary"></i>Preferensi</Link></li>
            <li><hr className="dropdown-divider my-1" /></li>
            <li><Link href="/auth/login" className="dropdown-item py-2 fw-semibold rounded-3 text-danger" style={{ fontSize: '13px' }} onClick={() => fetch('/api/auth/signout', {method:'POST'})}><i className="bi bi-box-arrow-right me-2"></i>Keluar</Link></li>
          </ul>
        </div>
      </div>
    </header>
  )
}
