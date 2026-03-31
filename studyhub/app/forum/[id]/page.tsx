'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Reply {
  id: string
  content: string
  upvotes: number
  isBestAnswer: boolean
  createdAt: string
  user: { id: string; name: string; image: string | null }
  thread: { id: string }
}

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
  replies: Reply[]
  _count: { replies: number }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

function Avatar({ user, size = 34 }: { user: { name: string; image: string | null }, size?: number }) {
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

export default function ForumThreadPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const threadId = params.id as string

  const [thread, setThread] = useState<Thread | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchThread = async () => {
    try {
      const res = await fetch(`/api/forum/${threadId}`)
      if (!res.ok) { router.push('/forum'); return }
      setThread(await res.json())
    } catch { router.push('/forum') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchThread() }, [threadId])

  const handleUpvote = async () => {
    await fetch(`/api/forum/${threadId}/upvote`, { method: 'POST' })
    fetchThread()
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/forum/${threadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, parentId: replyingTo }),
      })
      if (!res.ok) throw new Error(await res.json().then(d => d.error))
      setReplyContent(''); setReplyingTo(null); fetchThread()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim reply')
    } finally { setSubmitting(false) }
  }

  const handleUpvoteReply = async (replyId: string) => {
    await fetch(`/api/forum/${threadId}/reply`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyId, action: 'upvote' }),
    })
    fetchThread()
  }

  const handleBestAnswer = async (replyId: string) => {
    await fetch(`/api/forum/${threadId}/reply`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyId, action: 'best_answer' }),
    })
    fetchThread()
  }

  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#6366f1' }} />
    </div>
  )
  if (!thread) return null

  const isOwner = session?.user?.id === thread.user.id

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/forum" className="btn btn-sm rounded-pill mb-4 d-inline-flex align-items-center gap-1"
        style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
        <i className="bi bi-arrow-left" /> Kembali ke Forum
      </Link>

      {/* Thread Card */}
      <div className="card mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4">
          {/* Badges */}
          <div className="d-flex flex-wrap gap-2 mb-3">
            {thread.subject && (
              <span className="badge rounded-pill"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 12, padding: '4px 10px' }}>
                {thread.subject}
              </span>
            )}
            {thread.tags.map(tag => (
              <span key={tag} className="badge rounded-pill"
                style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--sh-muted)', fontSize: 11,
                  padding: '4px 10px', border: '1px solid var(--sh-border)' }}>
                #{tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="fw-bold mb-3" style={{ fontSize: '1.3rem', color: 'var(--sh-text)', lineHeight: 1.4 }}>
            {thread.title}
          </h1>

          {/* Author */}
          <div className="d-flex align-items-center gap-2 mb-4">
            <Avatar user={thread.user} />
            <div>
              <div className="fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>{thread.user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--sh-muted)' }}>{timeAgo(thread.createdAt)}</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--sh-text)', whiteSpace: 'pre-wrap' }}>
            {thread.content}
          </div>

          {/* Footer */}
          <div className="d-flex align-items-center gap-3 mt-4 pt-4 flex-wrap"
            style={{ borderTop: '1px solid var(--sh-border)' }}>
            <button onClick={handleUpvote}
              className="btn btn-sm rounded-pill d-flex align-items-center gap-2 fw-semibold"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                border: '1px solid rgba(99,102,241,0.25)', fontSize: 13 }}>
              <i className="bi bi-caret-up-fill" />
              <strong>{thread.upvotes}</strong> Upvote
            </button>
            <span style={{ fontSize: 12, color: 'var(--sh-muted)' }}>
              <i className="bi bi-chat me-1" />{thread._count.replies} reply
            </span>
            <span style={{ fontSize: 12, color: 'var(--sh-muted)' }}>
              <i className="bi bi-eye me-1" />{thread.views} views
            </span>
          </div>
        </div>
      </div>

      {/* Replies Header */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <i className="bi bi-chat-left-dots" style={{ color: '#6366f1' }} />
        <h5 className="fw-bold mb-0" style={{ color: 'var(--sh-text)' }}>
          {thread.replies.length} Jawaban
        </h5>
      </div>

      {/* Replies */}
      <div className="d-flex flex-column gap-3 mb-4">
        {thread.replies.length === 0 ? (
          <div className="text-center py-4 rounded-3"
            style={{ background: 'var(--sh-card-bg)', border: '1px dashed var(--sh-border)' }}>
            <i className="bi bi-chat-square" style={{ fontSize: 32, color: 'var(--sh-muted)' }} />
            <p className="mt-2 mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
              Belum ada jawaban. Jadilah yang pertama!
            </p>
          </div>
        ) : (
          thread.replies.map(reply => (
            <ReplyCard key={reply.id} reply={reply}
              isThreadOwner={isOwner} currentUserId={session?.user?.id ?? ''}
              onUpvote={() => handleUpvoteReply(reply.id)}
              onBestAnswer={() => handleBestAnswer(reply.id)}
              onReplyTo={() => setReplyingTo(reply.id === replyingTo ? null : reply.id)}
            />
          ))
        )}
      </div>

      {/* Reply Form */}
      <div className="card p-4" style={{ borderRadius: 16 }}>
        <div className="d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-reply" style={{ color: '#6366f1' }} />
          <h6 className="fw-bold mb-0" style={{ color: 'var(--sh-text)' }}>
            {replyingTo ? 'Membalas reply...' : 'Tulis Jawaban'}
          </h6>
          {replyingTo && (
            <button onClick={() => setReplyingTo(null)}
              className="btn btn-sm rounded-pill ms-2 px-2 py-0"
              style={{ fontSize: 11, color: 'var(--sh-muted)', background: 'rgba(0,0,0,0.06)', border: 'none' }}>
              Batal
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-3 p-3 mb-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReply}>
          <textarea className="form-control mb-3 rounded-3" rows={4}
            placeholder="Tulis jawabanmu di sini..."
            value={replyContent} onChange={(e) => setReplyContent(e.target.value)}
            style={{ resize: 'vertical' }} />
          <div className="d-flex justify-content-end">
            <button type="submit"
              className="btn rounded-pill px-4 fw-semibold"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none' }}
              disabled={submitting || !replyContent.trim()}>
              {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-send me-2" />}
              Kirim Jawaban
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReplyCard({ reply, isThreadOwner, currentUserId, onUpvote, onBestAnswer, onReplyTo }: {
  reply: Reply; isThreadOwner: boolean; currentUserId: string
  onUpvote: () => void; onBestAnswer: () => void; onReplyTo: () => void
}) {
  return (
    <div className="card" style={{
      borderRadius: 12,
      borderLeft: reply.isBestAnswer ? '3px solid #10b981' : '1px solid var(--sh-border)',
      background: reply.isBestAnswer ? 'rgba(16,185,129,0.04)' : 'var(--sh-card-bg)',
    }}>
      <div className="card-body p-3">
        {reply.isBestAnswer && (
          <div className="d-flex align-items-center gap-1 mb-2">
            <i className="bi bi-patch-check-fill" style={{ color: '#10b981' }} />
            <span className="fw-semibold" style={{ fontSize: 12, color: '#10b981' }}>Best Answer</span>
          </div>
        )}
        <div className="d-flex gap-3">
          <Avatar user={reply.user} size={34} />
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="fw-semibold" style={{ fontSize: 13, color: 'var(--sh-text)' }}>{reply.user.name}</span>
              <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>{timeAgo(reply.createdAt)}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sh-text)', whiteSpace: 'pre-wrap' }}>
              {reply.content}
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
              <button onClick={onUpvote}
                className="btn btn-sm rounded-pill px-2 py-0 d-flex align-items-center gap-1"
                style={{ fontSize: 12, background: 'transparent',
                  color: reply.upvotes > 0 ? '#6366f1' : 'var(--sh-muted)',
                  border: `1px solid ${reply.upvotes > 0 ? 'rgba(99,102,241,0.3)' : 'var(--sh-border)'}` }}>
                <i className="bi bi-caret-up" />{reply.upvotes}
              </button>
              <button onClick={onReplyTo}
                className="btn btn-sm rounded-pill px-2 py-0"
                style={{ fontSize: 12, background: 'transparent', color: 'var(--sh-muted)', border: '1px solid var(--sh-border)' }}>
                <i className="bi bi-reply me-1" />Balas
              </button>
              {isThreadOwner && !reply.isBestAnswer && (
                <button onClick={onBestAnswer}
                  className="btn btn-sm rounded-pill px-2 py-0"
                  style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <i className="bi bi-patch-check me-1" />Best Answer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
