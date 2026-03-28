'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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
  const updateTaskFilter = (key: 'status' | 'priority', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ''}`)
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
        <p className="topbar-caption mb-1">StudyHub Workspace</p>
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
        <button className="btn btn-sm topbar-icon-btn position-relative" title="Notifikasi">
          <i className="bi bi-bell" style={{ fontSize: 17 }}></i>
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 10 }}>
            3
          </span>
        </button>
        <Link href="/profile" className="topbar-avatar" title="Profil">
          <i className="bi bi-person-circle"></i>
        </Link>
      </div>
    </header>
  )
}
