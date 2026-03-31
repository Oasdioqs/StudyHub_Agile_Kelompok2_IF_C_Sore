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
  const notifRef = useRef<HTMLDivElement>(null)

  const updateTaskFilter = (key: 'status' | 'priority', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ''}`)
  }

  useEffect(() => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (data.notifications) {
          setNotifications(data.notifications)
          setUnreadCount(data.unreadCount || 0)
        }
      })
      .catch(() => {})
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
    setShowNotifs(!showNotifs)
    if (!showNotifs && unreadCount > 0) {
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    }
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
            className="btn btn-sm topbar-icon-btn position-relative" 
            title="Notifikasi"
            onClick={handleOpenNotifs}
          >
            <i className="bi bi-bell" style={{ fontSize: 17 }}></i>
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill border border-2 border-white" style={{ fontSize: 10, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="dropdown-menu dropdown-menu-end show shadow-lg border-0" style={{ position: 'absolute', top: '100%', right: 0, width: 340, padding: 0, marginTop: '12px', maxHeight: '420px', overflowY: 'auto', borderRadius: '16px', backdropFilter: 'blur(12px)', background: 'var(--sh-card-bg)', zIndex: 1050 }}>
              <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2"><i className="bi bi-bell-fill text-primary"></i> Notifikasi</h6>
                <button className="btn btn-sm btn-light py-0 px-2 rounded-pill" style={{ fontSize: '11px' }} onClick={() => setShowNotifs(false)}>Tutup</button>
              </div>
              {notifications.length === 0 ? (
                <div className="p-5 text-center text-secondary small">
                  <i className="bi bi-inbox-fill text-light d-block mb-3" style={{ fontSize: '3rem' }}></i>
                  Belum ada aktivitas baru.
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {notifications.map((n) => (
                    <div key={n.id} className={`list-group-item list-group-item-action p-3 border-bottom-0 border-top ${n.isRead ? '' : 'bg-primary bg-opacity-10'}`} onClick={() => { setShowNotifs(false); if (n.link) router.push(n.link); }} style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}>
                      <div className="d-flex w-100 justify-content-between mb-1 align-items-center">
                        <strong className="small text-truncate me-2 fw-bold" style={{ color: 'var(--sh-text)' }}>{n.title}</strong>
                        <span className="badge bg-light text-secondary rounded-pill" style={{ fontSize: '10px', fontWeight: 600 }}>{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mb-0 small text-secondary lh-sm" style={{ fontSize: '12px' }}>{n.message}</p>
                    </div>
                  ))}
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
