'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Thread {
  id: string
  title: string
  content: string
  subject: string | null
  tags: string[]
  upvotes: number
  views: number
  createdAt: string
  user: { id: string; name: string; image: string | null }
  _count: { replies: number }
}

const SUBJECTS = ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia',
  'Bahasa Inggris', 'Sejarah', 'Geografi', 'Ekonomi', 'Sosiologi', 'Pemrograman', 'Lainnya']

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

function Avatar({ user, size = 32 }: { user: { name: string; image: string | null }, size?: number }) {
  if (user.image) return (
    <img src={user.image} alt={user.name} width={size} height={size}
      className="rounded-circle" style={{ objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
      {user.name?.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ForumPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'latest' | 'popular' | 'unanswered'>('latest')
  const [subject, setSubject] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', subject: '', tags: '' })
  const [error, setError] = useState('')

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (subject) params.set('subject', subject)
      if (search) params.set('search', search)
      const res = await fetch(`/api/forum?${params}`)
      let data = await res.json()
      if (!Array.isArray(data)) data = []
      if (sort === 'unanswered') data = data.filter((t: Thread) => t._count.replies === 0)
      setThreads(data)
    } finally {
      setLoading(false)
    }
  }, [sort, subject, search])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError('Judul dan isi wajib diisi'); return }
    setSubmitting(true); setError('')
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, content: form.content, subject: form.subject || null, tags }),
      })
      if (!res.ok) throw new Error(await res.json().then(d => d.error))
      setShowModal(false)
      setForm({ title: '', content: '', subject: '', tags: '' })
      fetchThreads()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuat thread')
    } finally { setSubmitting(false) }
  }

  const sortTabs = [
    { key: 'latest' as const, label: 'Terbaru', icon: 'bi-clock' },
    { key: 'popular' as const, label: 'Terpopuler', icon: 'bi-fire' },
    { key: 'unanswered' as const, label: 'Belum Dijawab', icon: 'bi-question-circle' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: 'var(--sh-text)' }}>
            <i className="bi bi-chat-dots me-2" style={{ color: '#6366f1' }} />
            Forum Diskusi
          </h1>
          <p className="mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
            Tanya, diskusi, dan berbagi pengetahuan bersama
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setError('') }}
          className="btn fw-semibold rounded-pill px-4"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', whiteSpace: 'nowrap' }}>
          <i className="bi bi-plus-lg me-2" />Buat Thread
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-3 p-3 mb-4"
        style={{ background: 'var(--sh-card-bg)', border: '1px solid var(--sh-border)' }}>
        {/* Sort Tabs */}
        <div className="d-flex gap-2 mb-3 flex-wrap">
          {sortTabs.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setSort(key)}
              className="btn btn-sm rounded-pill fw-semibold px-3"
              style={{
                fontSize: 12,
                background: sort === key ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(99,102,241,0.08)',
                color: sort === key ? 'white' : '#6366f1',
                border: sort === key ? 'none' : '1px solid rgba(99,102,241,0.2)',
                transition: 'all 0.15s',
              }}>
              <i className={`bi ${icon} me-1`} />{label}
            </button>
          ))}
        </div>

        {/* Search + Subject */}
        <div className="d-flex gap-2 flex-wrap">
          <form className="d-flex gap-2 flex-grow-1" style={{ minWidth: 200 }}
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput) }}>
            <div className="position-relative flex-grow-1">
              <i className="bi bi-search position-absolute"
                style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sh-muted)', fontSize: 13 }} />
              <input className="form-control ps-4 rounded-pill" style={{ fontSize: 13 }}
                placeholder="Cari thread..." value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            {search && (
              <button type="button" className="btn btn-sm rounded-pill px-3"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                onClick={() => { setSearch(''); setSearchInput('') }}>
                <i className="bi bi-x" />
              </button>
            )}
          </form>
          <select className="form-select form-select-sm rounded-pill" style={{ width: 'auto', fontSize: 13, minWidth: 160 }}
            value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Semua Mapel</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Thread List */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: '#6366f1' }} />
          <p className="mt-3 mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>Memuat thread...</p>
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-5 rounded-3"
          style={{ background: 'var(--sh-card-bg)', border: '1px dashed var(--sh-border)' }}>
          <i className="bi bi-chat-square-dots" style={{ fontSize: 40, color: 'var(--sh-muted)' }} />
          <p className="mt-3 mb-3" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>
            {search || subject ? 'Tidak ada thread yang cocok.' : 'Belum ada thread. Jadilah yang pertama!'}
          </p>
          <button onClick={() => setShowModal(true)}
            className="btn rounded-pill px-4 fw-semibold"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
            <i className="bi bi-plus-lg me-2" />Buat Thread Pertama
          </button>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {threads.map(thread => (
            <ThreadCard key={thread.id} thread={thread}
              currentUserId={session?.user?.id ?? ''}
              onUpvote={fetchThreads} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content" style={{ border: '1px solid var(--sh-border)', borderRadius: 16 }}>
              <div className="modal-header border-0 pb-1 px-4 pt-4">
                <h5 className="modal-title fw-bold" style={{ color: 'var(--sh-text)' }}>
                  <i className="bi bi-pencil-square me-2" style={{ color: '#6366f1' }} />
                  Buat Thread Baru
                </h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body px-4 pb-0">
                  {error && (
                    <div className="rounded-3 p-3 mb-3 d-flex align-items-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13 }}>
                      <i className="bi bi-exclamation-triangle" />{error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                      Judul Thread <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input className="form-control rounded-3" placeholder="Tuliskan pertanyaan atau topik diskusimu..."
                      value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                      Isi / Deskripsi <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea className="form-control rounded-3" rows={6}
                      placeholder="Jelaskan pertanyaan atau topikmu secara detail..."
                      value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                  </div>
                  <div className="row g-3 mb-1">
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>Mata Pelajaran</label>
                      <select className="form-select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                        <option value="">Pilih mata pelajaran</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                        Tags <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--sh-muted)' }}>(pisah koma)</span>
                      </label>
                      <input className="form-control" placeholder="rumus, integral, contoh soal"
                        value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-3 gap-2">
                  <button type="button" className="btn rounded-pill px-4"
                    style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: 'none' }}
                    onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn rounded-pill px-4 fw-semibold"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}
                    disabled={submitting}>
                    {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-send me-2" />}
                    Posting Thread
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ThreadCard({ thread, currentUserId, onUpvote }: {
  thread: Thread; currentUserId: string; onUpvote: () => void
}) {
  const router = useRouter()
  const [upvoting, setUpvoting] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleUpvote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (upvoting) return
    setUpvoting(true)
    try { await fetch(`/api/forum/${thread.id}/upvote`, { method: 'POST' }); onUpvote() }
    finally { setUpvoting(false) }
  }

  const hasReplies = thread._count.replies > 0

  return (
    <div onClick={() => router.push(`/forum/${thread.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        background: 'var(--sh-card-bg)',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.4)' : 'var(--sh-border)'}`,
        borderLeft: `3px solid ${hovered ? '#6366f1' : 'transparent'}`,
        borderRadius: 12,
        padding: '16px 20px',
        transition: 'all 0.15s ease',
        transform: hovered ? 'translateX(3px)' : 'none',
      }}>
      <div className="d-flex align-items-start gap-3">
        {/* Upvote */}
        <div className="text-center d-flex flex-column align-items-center" style={{ minWidth: 40 }}>
          <button onClick={handleUpvote} disabled={upvoting}
            className="btn p-0 d-flex flex-column align-items-center"
            style={{ color: thread.upvotes > 0 ? '#6366f1' : 'var(--sh-muted)', transition: 'color 0.15s' }}>
            <i className="bi bi-caret-up-fill" style={{ fontSize: 20 }} />
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{thread.upvotes}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          {/* Badges */}
          <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
            {thread.subject && (
              <span className="badge rounded-pill" style={{
                background: 'rgba(99,102,241,0.12)', color: '#6366f1',
                fontSize: 11, padding: '3px 8px',
              }}>{thread.subject}</span>
            )}
            {thread.tags.slice(0, 2).map(tag => (
              <span key={tag} className="badge rounded-pill"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--sh-muted)', fontSize: 10,
                  padding: '3px 8px', border: '1px solid var(--sh-border)' }}>
                #{tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <div className="fw-semibold mb-1" style={{ fontSize: 15, color: 'var(--sh-text)', lineHeight: 1.4 }}>
            {thread.title}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--sh-muted)', lineHeight: 1.5, marginBottom: 10,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {thread.content}
          </div>

          {/* Footer */}
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-1">
              <Avatar user={thread.user} size={22} />
              <span style={{ fontSize: 12, color: 'var(--sh-muted)' }}>{thread.user.name}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>
              <i className="bi bi-clock me-1" />{timeAgo(thread.createdAt)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>
              <i className="bi bi-eye me-1" />{thread.views}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: hasReplies ? '#10b981' : '#f59e0b',
            }}>
              <i className="bi bi-chat me-1" />
              {hasReplies ? `${thread._count.replies} reply` : 'Belum ada reply'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
