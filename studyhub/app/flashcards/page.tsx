'use client'
import { useState, useEffect } from 'react'

interface Flashcard { id: string; question: string; answer: string; difficulty: number }
interface FlashcardSet {
  id: string; title: string; subject: string | null; createdAt: string
  _count: { flashcards: number }; flashcards?: Flashcard[]
}

const SUBJECTS = ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia',
  'Bahasa Inggris', 'Sejarah', 'Geografi', 'Ekonomi', 'Sosiologi', 'Pemrograman', 'Lainnya']

const SUBJECT_COLORS: Record<string, string> = {
  'Matematika': '#6366f1', 'Fisika': '#0ea5e9', 'Kimia': '#10b981',
  'Biologi': '#22c55e', 'Bahasa Indonesia': '#f59e0b', 'Bahasa Inggris': '#8b5cf6',
  'Pemrograman': '#6366f1', 'default': '#94a3b8',
}

function getSubjectColor(subject: string | null) {
  return SUBJECT_COLORS[subject ?? ''] ?? SUBJECT_COLORS.default
}

type View = 'list' | 'detail' | 'quiz'

export default function FlashcardsPage() {
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [activeSet, setActiveSet] = useState<FlashcardSet | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [form, setForm] = useState({ title: '', subject: '' })
  const [cardForm, setCardForm] = useState({ question: '', answer: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Quiz
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizFlipped, setQuizFlipped] = useState(false)
  const [quizScore, setQuizScore] = useState({ correct: 0, wrong: 0 })
  const [quizDone, setQuizDone] = useState(false)

  const fetchSets = async () => {
    const res = await fetch('/api/flashcards')
    const data = await res.json()
    setSets(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const fetchDetail = async (id: string) => {
    const res = await fetch(`/api/flashcards/${id}`)
    setActiveSet(await res.json())
  }

  useEffect(() => { fetchSets() }, [])

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, subject: form.subject || null }),
      })
      if (!res.ok) throw new Error(await res.json().then(d => d.error))
      setShowCreateModal(false); setForm({ title: '', subject: '' }); fetchSets()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Gagal membuat set') }
    finally { setSubmitting(false) }
  }

  const handleDeleteSet = async (id: string) => {
    if (!confirm('Hapus set beserta semua kartu?')) return
    await fetch(`/api/flashcards/${id}`, { method: 'DELETE' })
    if (activeSet?.id === id) { setView('list'); setActiveSet(null) }
    fetchSets()
  }

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSet || !cardForm.question.trim() || !cardForm.answer.trim()) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/flashcards/${activeSet.id}/cards`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardForm),
      })
      if (!res.ok) throw new Error(await res.json().then(d => d.error))
      setShowAddCardModal(false); setCardForm({ question: '', answer: '' })
      fetchDetail(activeSet.id)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Gagal tambah kartu') }
    finally { setSubmitting(false) }
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!activeSet) return
    await fetch(`/api/flashcards/${activeSet.id}/cards?cardId=${cardId}`, { method: 'DELETE' })
    fetchDetail(activeSet.id)
  }

  const startQuiz = () => {
    setQuizIndex(0); setQuizFlipped(false)
    setQuizScore({ correct: 0, wrong: 0 }); setQuizDone(false)
    setView('quiz')
  }

  // ── QUIZ VIEW ─────────────────────────────────────────────
  if (view === 'quiz' && activeSet?.flashcards) {
    const cards = activeSet.flashcards
    const total = cards.length

    if (quizDone) return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <div className="card text-center p-5" style={{ maxWidth: 400, width: '100%', borderRadius: 20 }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <h4 className="fw-bold mt-3 mb-4" style={{ color: 'var(--sh-text)' }}>Quiz Selesai!</h4>
          <div className="d-flex justify-content-center gap-5 mb-4">
            <div>
              <div className="fw-bold" style={{ fontSize: 32, color: '#10b981' }}>{quizScore.correct}</div>
              <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>Benar ✅</div>
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: 32, color: '#ef4444' }}>{quizScore.wrong}</div>
              <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>Salah ❌</div>
            </div>
          </div>
          {/* Score bar */}
          <div className="mb-2" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
            Skor: {Math.round((quizScore.correct / total) * 100)}%
          </div>
          <div className="progress mb-4" style={{ height: 8, borderRadius: 99 }}>
            <div className="progress-bar"
              style={{ width: `${Math.round((quizScore.correct / total) * 100)}%`,
                background: 'linear-gradient(90deg,#6366f1,#10b981)', borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
          <div className="d-flex gap-2 justify-content-center">
            <button onClick={startQuiz} className="btn rounded-pill px-4 fw-semibold"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
              Ulangi
            </button>
            <button onClick={() => setView('detail')} className="btn rounded-pill px-4"
              style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: '1px solid var(--sh-border)' }}>
              Kembali
            </button>
          </div>
        </div>
      </div>
    )

    const card = cards[quizIndex]
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <button onClick={() => setView('detail')} className="btn btn-sm rounded-pill"
            style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: '1px solid var(--sh-border)' }}>
            <i className="bi bi-arrow-left me-1" /> Batal Quiz
          </button>
          <span style={{ fontSize: 13, color: 'var(--sh-muted)', fontWeight: 500 }}>
            {quizIndex + 1} / {total}
          </span>
        </div>
        <div className="progress mb-4" style={{ height: 6, borderRadius: 99 }}>
          <div className="progress-bar"
            style={{ width: `${(quizIndex / total) * 100}%`,
              background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.3s' }} />
        </div>

        {/* Flashcard */}
        <div onClick={() => setQuizFlipped(!quizFlipped)}
          style={{
            cursor: 'pointer', minHeight: 220, marginBottom: 24, borderRadius: 20,
            padding: '32px 28px',
            background: quizFlipped
              ? 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.06))'
              : 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.06))',
            border: `2px solid ${quizFlipped ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', transition: 'all 0.3s ease',
          }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em',
            color: quizFlipped ? '#10b981' : '#6366f1', fontWeight: 600, marginBottom: 12 }}>
            {quizFlipped ? '✅ Jawaban' : '❓ Pertanyaan'}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--sh-text)', lineHeight: 1.6 }}>
            {quizFlipped ? card.answer : card.question}
          </div>
          {!quizFlipped && (
            <div style={{ fontSize: 12, color: 'var(--sh-muted)', marginTop: 16 }}>
              Klik untuk lihat jawaban
            </div>
          )}
        </div>

        {quizFlipped && (
          <div className="d-flex gap-3 justify-content-center">
            <button onClick={() => {
              const next = quizIndex + 1
              setQuizScore(s => ({ ...s, wrong: s.wrong + 1 }))
              if (next >= total) setQuizDone(true)
              else { setQuizIndex(next); setQuizFlipped(false) }
            }} className="btn rounded-pill px-4 fw-semibold"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
              <i className="bi bi-x-circle me-2" />Tidak Tahu
            </button>
            <button onClick={() => {
              const next = quizIndex + 1
              setQuizScore(s => ({ ...s, correct: s.correct + 1 }))
              if (next >= total) setQuizDone(true)
              else { setQuizIndex(next); setQuizFlipped(false) }
            }} className="btn rounded-pill px-4 fw-semibold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              <i className="bi bi-check-circle me-2" />Tahu!
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── DETAIL VIEW ───────────────────────────────────────────
  if (view === 'detail' && activeSet) {
    const cards = activeSet.flashcards ?? []
    const color = getSubjectColor(activeSet.subject)
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <button onClick={() => setView('list')} className="btn btn-sm rounded-pill mb-4"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: '1px solid var(--sh-border)' }}>
          <i className="bi bi-arrow-left me-1" /> Semua Set
        </button>

        <div className="d-flex align-items-start justify-content-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              {activeSet.subject && (
                <span className="badge rounded-pill"
                  style={{ background: `${color}18`, color, fontSize: 11, padding: '3px 10px' }}>
                  {activeSet.subject}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--sh-muted)' }}>{cards.length} kartu</span>
            </div>
            <h2 className="fw-bold mb-0" style={{ fontSize: '1.3rem', color: 'var(--sh-text)' }}>
              {activeSet.title}
            </h2>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button onClick={() => { setShowAddCardModal(true); setError('') }}
              className="btn btn-sm rounded-pill px-3"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
              <i className="bi bi-plus-lg me-1" />Tambah Kartu
            </button>
            {cards.length > 0 && (
              <button onClick={startQuiz} className="btn btn-sm rounded-pill px-3 fw-semibold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
                <i className="bi bi-lightning me-1" />Mulai Quiz
              </button>
            )}
            <button onClick={() => handleDeleteSet(activeSet.id)} className="btn btn-sm rounded-pill px-3"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-5 rounded-3"
            style={{ background: 'var(--sh-card-bg)', border: '1px dashed var(--sh-border)' }}>
            <i className="bi bi-card-list" style={{ fontSize: 40, color: 'var(--sh-muted)' }} />
            <p className="mt-3 mb-3" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>Belum ada kartu. Tambah kartu dulu!</p>
            <button onClick={() => { setShowAddCardModal(true); setError('') }}
              className="btn rounded-pill px-4 fw-semibold"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
              <i className="bi bi-plus me-2" />Tambah Kartu Pertama
            </button>
          </div>
        ) : (
          <div className="row g-3">
            {cards.map((card, idx) => (
              <div key={card.id} className="col-md-6">
                <div className="card h-100 p-3"
                  style={{ borderRadius: 12, borderTop: `3px solid ${color}` }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="badge rounded-pill"
                      style={{ fontSize: 10, background: `${color}15`, color }}>
                      #{idx + 1}
                    </span>
                    <button onClick={() => handleDeleteCard(card.id)} className="btn p-0"
                      style={{ color: 'var(--sh-muted)', lineHeight: 1 }}>
                      <i className="bi bi-x" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--sh-muted)', marginBottom: 4 }}>
                      Pertanyaan
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sh-text)', lineHeight: 1.5 }}>
                      {card.question}
                    </div>
                  </div>
                  <div style={{ paddingTop: 10, borderTop: '1px dashed var(--sh-border)' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--sh-muted)', marginBottom: 4 }}>
                      Jawaban
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--sh-text)', lineHeight: 1.5 }}>
                      {card.answer}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Card Modal */}
        {showAddCardModal && (
          <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content" style={{ borderRadius: 16, border: '1px solid var(--sh-border)' }}>
                <div className="modal-header border-0 px-4 pt-4 pb-1">
                  <h5 className="modal-title fw-bold" style={{ color: 'var(--sh-text)' }}>
                    <i className="bi bi-plus-circle me-2" style={{ color: '#6366f1' }} />Tambah Kartu
                  </h5>
                  <button className="btn-close" onClick={() => setShowAddCardModal(false)} />
                </div>
                <form onSubmit={handleAddCard}>
                  <div className="modal-body px-4 pb-0">
                    {error && (
                      <div className="rounded-3 p-3 mb-3"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}>
                        {error}
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                        Pertanyaan <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <textarea className="form-control rounded-3" rows={3} placeholder="Tulis pertanyaan..."
                        value={cardForm.question} onChange={e => setCardForm({ ...cardForm, question: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                        Jawaban <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <textarea className="form-control rounded-3" rows={3} placeholder="Tulis jawaban..."
                        value={cardForm.answer} onChange={e => setCardForm({ ...cardForm, answer: e.target.value })} />
                    </div>
                  </div>
                  <div className="modal-footer border-0 px-4 pb-4 pt-3 gap-2">
                    <button type="button" className="btn rounded-pill px-4"
                      style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: 'none' }}
                      onClick={() => setShowAddCardModal(false)}>Batal</button>
                    <button type="submit" className="btn rounded-pill px-4 fw-semibold"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}
                      disabled={submitting}>
                      {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-plus me-2" />}
                      Tambah
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

  // ── LIST VIEW ──────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: 'var(--sh-text)' }}>
            <i className="bi bi-card-list me-2" style={{ color: '#6366f1' }} />Flashcard
          </h1>
          <p className="mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
            Buat dan kelola kartu belajar interaktif
          </p>
        </div>
        <button onClick={() => { setShowCreateModal(true); setError('') }}
          className="btn rounded-pill fw-semibold px-4"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', whiteSpace: 'nowrap' }}>
          <i className="bi bi-plus-lg me-2" />Buat Set Baru
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: '#6366f1' }} />
        </div>
      ) : sets.length === 0 ? (
        <div className="text-center py-5 rounded-3"
          style={{ background: 'var(--sh-card-bg)', border: '1px dashed var(--sh-border)' }}>
          <i className="bi bi-card-list" style={{ fontSize: 44, color: 'var(--sh-muted)' }} />
          <p className="mt-3 mb-3" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>
            Belum ada set flashcard. Buat yang pertama!
          </p>
          <button onClick={() => { setShowCreateModal(true); setError('') }}
            className="btn rounded-pill px-4 fw-semibold"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}>
            <i className="bi bi-plus-lg me-2" />Buat Set Pertama
          </button>
        </div>
      ) : (
        <div className="row g-3">
          {sets.map(set => {
            const color = getSubjectColor(set.subject)
            return (
              <div key={set.id} className="col-md-4 col-sm-6">
                <div className="card h-100 p-0 overflow-hidden"
                  style={{ cursor: 'pointer', borderRadius: 16, borderTop: `3px solid ${color}`, transition: 'all 0.2s' }}
                  onClick={() => { fetchDetail(set.id).then(() => setView('detail')) }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'}>
                  <div className="p-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: 44, height: 44, background: `${color}15` }}>
                        <i className="bi bi-card-list" style={{ fontSize: 20, color }} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleDeleteSet(set.id) }}
                        className="btn p-1" style={{ color: 'var(--sh-muted)', lineHeight: 1, borderRadius: 8 }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--sh-muted)'}>
                        <i className="bi bi-trash" style={{ fontSize: 14 }} />
                      </button>
                    </div>
                    <div className="fw-semibold mb-1" style={{ fontSize: 15, color: 'var(--sh-text)', lineHeight: 1.3 }}>
                      {set.title}
                    </div>
                    {set.subject && (
                      <span className="badge rounded-pill mb-2 d-inline-block"
                        style={{ background: `${color}15`, color, fontSize: 10, padding: '2px 8px' }}>
                        {set.subject}
                      </span>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>
                      <i className="bi bi-layers me-1" />{set._count.flashcards} kartu
                    </div>
                  </div>
                  <div className="px-4 py-2"
                    style={{ borderTop: '1px solid var(--sh-border)', background: `${color}06` }}>
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                      <i className="bi bi-play-circle me-1" />Mulai Quiz →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Set Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: 16, border: '1px solid var(--sh-border)' }}>
              <div className="modal-header border-0 px-4 pt-4 pb-1">
                <h5 className="modal-title fw-bold" style={{ color: 'var(--sh-text)' }}>
                  <i className="bi bi-plus-circle me-2" style={{ color: '#6366f1' }} />Buat Set Flashcard
                </h5>
                <button className="btn-close" onClick={() => setShowCreateModal(false)} />
              </div>
              <form onSubmit={handleCreateSet}>
                <div className="modal-body px-4 pb-0">
                  {error && (
                    <div className="rounded-3 p-3 mb-3"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13 }}>
                      {error}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                      Nama Set <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input className="form-control rounded-3" placeholder="cth: Rumus Fisika Kelas 12"
                      value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>
                      Mata Pelajaran
                    </label>
                    <select className="form-select rounded-3" value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}>
                      <option value="">Pilih mata pelajaran (opsional)</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-3 gap-2">
                  <button type="button" className="btn rounded-pill px-4"
                    style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-text)', border: 'none' }}
                    onClick={() => setShowCreateModal(false)}>Batal</button>
                  <button type="submit" className="btn rounded-pill px-4 fw-semibold"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}
                    disabled={submitting}>
                    {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check-lg me-2" />}
                    Buat Set
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
