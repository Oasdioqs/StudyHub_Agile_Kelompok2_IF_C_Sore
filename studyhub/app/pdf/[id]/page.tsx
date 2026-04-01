'use client'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type Challenge = {
  id: string
  question: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  sortOrder: number
}

type PdfDetail = {
  id: string
  title: string
  fileName: string
  pageCount: number
  charCount: number
  summary: string | null
  status: string
  createdAt: string
  challenges: Challenge[]
}

const diffConfig = {
  easy:   { cls: 'bg-success bg-opacity-10 text-success', label: 'Mudah' },
  medium: { cls: 'bg-warning bg-opacity-10 text-warning', label: 'Sedang' },
  hard:   { cls: 'bg-danger bg-opacity-10 text-danger',   label: 'Sulit' },
}

function ChallengeCard({ c, idx }: { c: Challenge; idx: number }) {
  const [revealed, setRevealed] = useState(false)
  const dc = diffConfig[c.difficulty] ?? diffConfig.medium
  return (
    <div className="card mb-3" style={{ borderRadius: 12 }}>
      <div className="card-body py-3">
        <div className="d-flex align-items-start gap-2 mb-2">
          <span style={{ width: 24, height: 24, borderRadius: 999, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {idx + 1}
          </span>
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span className={`badge rounded-pill px-2 ${dc.cls}`} style={{ fontSize: 10 }}>{dc.label}</span>
            </div>
            <p className="mb-0 fw-semibold" style={{ fontSize: 14, lineHeight: 1.5 }}>{c.question}</p>
          </div>
        </div>
        {revealed ? (
          <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>JAWABAN</span>
            </div>
            <p className="mb-0" style={{ fontSize: 13, color: 'var(--sh-text)', lineHeight: 1.55 }}>{c.answer}</p>
            <button className="btn btn-sm btn-outline-secondary mt-2" style={{ fontSize: 11 }} onClick={() => setRevealed(false)}>
              Sembunyikan
            </button>
          </div>
        ) : (
          <button
            className="btn btn-sm btn-outline-primary mt-2"
            style={{ fontSize: 11, borderRadius: 8 }}
            onClick={() => setRevealed(true)}
          >
            <i className="bi bi-eye me-1" />Lihat Jawaban
          </button>
        )}
      </div>
    </div>
  )
}

export default function PdfDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [doc, setDoc] = useState<PdfDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'summary' | 'challenges' | 'ask'>('summary')

  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    axios.get(`/api/pdf/${id}`)
      .then(({ data }) => setDoc(data))
      .catch(() => router.push('/pdf-library'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const generateSummary = async () => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const { data } = await axios.post(`/api/pdf/${id}/summarize`)
      setDoc((prev) => prev ? { ...prev, summary: data.summary } : prev)
    } catch (err: any) {
      setSummaryError(err?.response?.data?.error ?? 'Gagal membuat ringkasan.')
    } finally {
      setSummaryLoading(false)
    }
  }

  const generateChallenges = async () => {
    setGenLoading(true)
    setGenError('')
    try {
      const { data } = await axios.post(`/api/pdf/${id}/challenges`)
      setDoc((prev) => prev ? { ...prev, challenges: data.challenges } : prev)
      setTab('challenges')
    } catch (err: any) {
      setGenError(err?.response?.data?.error ?? 'Gagal membuat soal.')
    } finally {
      setGenLoading(false)
    }
  }

  const handleAsk = async (e: React.FormEvent | null, overrideQuestion?: string) => {
    if (e) e.preventDefault()
    const q = (overrideQuestion ?? question).trim()
    if (!q || asking) return
    setQuestion('')
    const newHistory = [...chatHistory, { role: 'user' as const, text: q }]
    setChatHistory(newHistory)
    setAsking(true)
    try {
      // Kirim history conversation agar AI punya konteks percakapan sebelumnya
      const historyPayload = newHistory
        .slice(-8) // 8 pesan terakhir
        .filter((h) => h.role === 'user' || h.role === 'ai')
        .slice(0, -1) // hapus pesan terakhir (sudah jadi question)
        .map((h) => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text }))

      const { data } = await axios.post(`/api/pdf/${id}/ask`, {
        question: q,
        history: historyPayload,
      })
      setChatHistory((prev) => [...prev, { role: 'ai', text: data.answer }])
    } catch (err: any) {
      setChatHistory((prev) => [...prev, { role: 'ai', text: '⚠️ ' + (err?.response?.data?.error ?? 'Gagal mendapatkan jawaban.') }])
    } finally {
      setAsking(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Sidebar />
        <div className="app-main">
          <TopbarShell />
          <main className="p-4 d-flex align-items-center justify-content-center" style={{ minHeight: 300 }}>
            <div className="text-center">
              <div className="spinner-border text-primary mb-3" />
              <p className="text-muted small">Memuat dokumen…</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition" style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Header */}
          <div className="d-flex align-items-start gap-3 mb-4">
            <Link href="/pdf-library" className="btn btn-sm btn-outline-secondary mt-1" style={{ flexShrink: 0 }}>
              <i className="bi bi-arrow-left" />
            </Link>
            <div className="flex-grow-1 overflow-hidden">
              <h5 className="fw-bold mb-1 text-truncate" title={doc.title}>{doc.title}</h5>
              <p className="text-muted small mb-0">
                {doc.pageCount > 0 && <><i className="bi bi-file-earmark-text me-1" />{doc.pageCount} halaman · </>}
                {doc.fileName}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="d-flex gap-1 mb-4 p-1 rounded-3" style={{ background: 'var(--sh-card-bg)', border: '1px solid var(--sh-border)', width: 'fit-content' }}>
            {([
              { key: 'summary',    icon: 'bi-file-text',         label: 'Ringkasan' },
              { key: 'challenges', icon: 'bi-patch-question',    label: `Tantangan ${doc.challenges.length > 0 ? `(${doc.challenges.length})` : ''}` },
              { key: 'ask',        icon: 'bi-robot',             label: 'Tanya AI' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-light'}`}
                style={{ borderRadius: 8, fontSize: 13, fontWeight: tab === t.key ? 700 : 500 }}
              >
                <i className={`bi ${t.icon} me-1`} />{t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Ringkasan ── */}
          {tab === 'summary' && (
            <div>
              {doc.summary ? (
                <div className="card" style={{ borderRadius: 14 }}>
                  <div className="card-body" style={{ padding: '20px 24px' }}>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span style={{ fontSize: 20 }}>🤖</span>
                      <span className="fw-bold" style={{ fontSize: 14 }}>Ringkasan AI</span>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 ms-auto" style={{ fontSize: 10 }}>
                        <i className="bi bi-check-circle me-1" />Auto-generated
                      </span>
                    </div>
                    <div
                      className="pdf-summary-content"
                      style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--sh-text)' }}
                      dangerouslySetInnerHTML={{
                        __html: doc.summary
                          // Code blocks dengan bahasa
                          .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
                            `<pre style="background:var(--sh-hover);border:1px solid var(--sh-border);border-radius:10px;padding:12px 14px;overflow-x:auto;font-size:12.5px;margin:10px 0;"><div style="font-size:10px;color:var(--sh-muted);margin-bottom:6px;font-weight:700;">${lang?.toUpperCase() || 'CODE'}</div><code style="font-family:monospace;color:var(--sh-text);white-space:pre;">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;').trim()}</code></pre>`)
                          // Inline code
                          .replace(/`([^`]+)`/g, '<code style="background:var(--sh-hover);border-radius:4px;padding:1px 5px;font-size:12px;font-family:monospace;">$1</code>')
                          // H2 headers (##)
                          .replace(/^## (.+)$/gm, '<h6 style="font-weight:700;margin:18px 0 8px;font-size:14px;color:var(--sh-text);display:flex;align-items:center;gap:6px;">$1</h6>')
                          // Bold
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          // Bullet points
                          .replace(/^[-•]\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;"><span style="color:#6366f1;flex-shrink:0;">▸</span><span>$1</span></div>')
                          // Numbered lists
                          .replace(/^(\d+)\.\s(.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;"><span style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">$1</span><span>$2</span></div>')
                          // Line breaks
                          .replace(/\n\n/g, '<br/>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <p className="fw-semibold mb-1">Ringkasan belum dibuat</p>
                  <p className="text-muted small mb-3">Klik tombol di bawah untuk membuat ringkasan otomatis dengan AI</p>
                  {summaryError && (
                    <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13, borderRadius: 10 }}>{summaryError}</div>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={generateSummary}
                    disabled={summaryLoading}
                  >
                    {summaryLoading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Membuat ringkasan…</>
                      : <><i className="bi bi-magic me-2" />Buat Ringkasan AI</>}
                  </button>
                </div>
              )}

              <div className="mt-4 d-flex gap-2 flex-wrap align-items-center">
                <button className="btn btn-outline-primary btn-sm" onClick={() => setTab('challenges')}>
                  <i className="bi bi-patch-question me-1" />Lihat Soal Tantangan
                </button>
                <button className="btn btn-outline-success btn-sm" onClick={() => setTab('ask')}>
                  <i className="bi bi-robot me-1" />Tanya Sesuatu tentang PDF Ini
                </button>
                {doc.summary && (
                  <button
                    className="btn btn-outline-secondary btn-sm ms-auto"
                    onClick={generateSummary}
                    disabled={summaryLoading}
                  >
                    {summaryLoading
                      ? <span className="spinner-border spinner-border-sm" />
                      : <><i className="bi bi-arrow-clockwise me-1" />Buat Ulang</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Tantangan ── */}
          {tab === 'challenges' && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <span className="fw-bold" style={{ fontSize: 14 }}>Soal Tantangan</span>
                  {doc.challenges.length > 0 && (
                    <span className="text-muted small ms-2">{doc.challenges.length} soal</span>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={generateChallenges}
                  disabled={genLoading}
                >
                  {genLoading ? (
                    <><span className="spinner-border spinner-border-sm me-1" />Membuat soal…</>
                  ) : (
                    <><i className="bi bi-stars me-1" />{doc.challenges.length > 0 ? 'Buat Ulang' : 'Generate Soal AI'}</>
                  )}
                </button>
              </div>

              {genError && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3" style={{ borderRadius: 10, fontSize: 13 }}>
                  <i className="bi bi-exclamation-triangle-fill" />{genError}
                </div>
              )}

              {doc.challenges.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
                  <p className="fw-semibold mb-1">Belum ada soal tantangan</p>
                  <p className="small mb-3">Klik "Generate Soal AI" untuk membuat 8 soal otomatis dari isi PDF</p>
                  <button className="btn btn-primary" onClick={generateChallenges} disabled={genLoading}>
                    {genLoading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-stars me-1" />Generate Soal Sekarang</>}
                  </button>
                </div>
              ) : (
                <>
                  <div className="d-flex gap-2 mb-3 flex-wrap">
                    {(['easy', 'medium', 'hard'] as const).map((d) => {
                      const count = doc.challenges.filter((c) => c.difficulty === d).length
                      return count > 0 ? (
                        <span key={d} className={`badge rounded-pill px-3 py-1 ${diffConfig[d].cls}`} style={{ fontSize: 11 }}>
                          {diffConfig[d].label}: {count}
                        </span>
                      ) : null
                    })}
                  </div>
                  {doc.challenges.map((c, i) => <ChallengeCard key={c.id} c={c} idx={i} />)}
                </>
              )}
            </div>
          )}

          {/* ── TAB: Tanya AI ── */}
          {tab === 'ask' && (
            <div>
              <div className="card mb-3" style={{ borderRadius: 14, overflow: 'hidden' }}>
                <div className="card-header py-2 px-3" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 0 }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: 16 }}>🤖</span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Tanya AI tentang "{doc.title}"</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, margin: 0, marginTop: 2 }}>
                    AI akan menjawab berdasarkan isi PDF ini saja
                  </p>
                </div>

                {/* Chat history */}
                <div
                  style={{ minHeight: 200, maxHeight: 420, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--sh-card-bg)' }}
                >
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                      <p className="small mb-1 fw-semibold">Apa yang ingin kamu tanyakan?</p>
                      <p className="small mb-0">Contoh: "Apa konsep utama dari dokumen ini?" atau "Jelaskan bagian tentang X"</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            background: msg.role === 'user'
                              ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                              : 'var(--sh-card-bg)',
                            border: msg.role === 'user' ? 'none' : '1px solid var(--sh-border)',
                            color: msg.role === 'user' ? '#fff' : 'var(--sh-text)',
                            fontSize: 13,
                            lineHeight: 1.7,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          }}
                        >
                          {msg.role === 'ai' ? (
                            <div
                              className="ai-chat-content"
                              dangerouslySetInnerHTML={{
                                __html: msg.text
                                  // Code blocks dengan bahasa
                                  .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
                                    `<pre style="background:var(--sh-hover);border:1px solid var(--sh-border);border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:12px;margin:6px 0;"><code style="font-family:monospace;color:var(--sh-text);">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
                                  // Inline code
                                  .replace(/`([^`]+)`/g, '<code style="background:var(--sh-hover);border-radius:4px;padding:1px 5px;font-size:12px;font-family:monospace;">$1</code>')
                                  // Bold
                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                  // Italic
                                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                  // Line breaks
                                  .replace(/\n/g, '<br/>')
                              }}
                            />
                          ) : (
                            <span>{msg.text}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {asking && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', border: '1px solid var(--sh-border)', background: 'var(--sh-card-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="spinner-border spinner-border-sm text-primary" style={{ width: 14, height: 14 }} />
                        <span className="text-muted small">AI sedang membaca PDF…</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="card-footer p-3" style={{ border: 0, background: 'var(--sh-card-bg)', borderTop: '1px solid var(--sh-border)' }}>
                  <form onSubmit={handleAsk} className="d-flex gap-2">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tanya sesuatu tentang PDF ini…"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={asking}
                      style={{ borderRadius: 10, fontSize: 13 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!question.trim() || asking}
                      style={{ borderRadius: 10, flexShrink: 0 }}
                    >
                      <i className="bi bi-send-fill" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Suggested questions */}
              <div>
                <p className="text-muted small fw-semibold mb-2">Pertanyaan yang sering ditanya:</p>
                <div className="d-flex flex-wrap gap-2">
                  {[
                    'Apa topik utama dokumen ini?',
                    'Sebutkan poin-poin terpenting',
                    'Jelaskan konsep yang paling sulit',
                    'Ada kode program di dokumen ini?',
                    'Apa kesimpulan dari dokumen ini?',
                    'Buatkan contoh soal dari materi ini',
                  ].map((q) => (
                    <button
                      key={q}
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: 11, borderRadius: 999 }}
                      onClick={() => handleAsk(null, q)}
                      disabled={asking}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
