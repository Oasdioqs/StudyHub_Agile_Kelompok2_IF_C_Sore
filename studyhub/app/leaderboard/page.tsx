'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface LeaderboardUser {
  id: string
  name: string
  image: string | null
  institution: string | null
  major: string | null
  points: number
  streak: number
  rank: number
  badges: string[]
  isCurrentUser: boolean
  _count: { tasks: number; timerSessions: number; threads: number }
}

function Avatar({ user, size = 40 }: { user: { name: string; image: string | null }, size?: number }) {
  if (user.image) return (
    <img src={user.image} alt={user.name} width={size} height={size}
      className="rounded-circle" style={{ objectFit: 'cover', flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.2)' }} />
  )
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.35, flexShrink: 0,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
      {user.name?.charAt(0).toUpperCase()}
    </div>
  )
}

export default function LeaderboardPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => { setUsers(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Gagal memuat leaderboard'); setLoading(false) })
  }, [])

  const currentUserRank = users.find((u) => u.isCurrentUser)

  // Podium: index 0 = 2nd place (left), index 1 = 1st place (center), index 2 = 3rd place (right)
  const podiumOrder = [users[1], users[0], users[2]].filter(Boolean)
  const rest = users.slice(3)

  const podiumConfig = [
    { rank: 2, height: 100, medalColor: 'linear-gradient(135deg,#94a3b8,#64748b)', emoji: '🥈', label: '2nd' },
    { rank: 1, height: 140, medalColor: 'linear-gradient(135deg,#fbbf24,#d97706)', emoji: '🥇', label: '1st' },
    { rank: 3, height: 72, medalColor: 'linear-gradient(135deg,#cd7c2f,#92400e)', emoji: '🥉', label: '3rd' },
  ]

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-5">
        <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
        <h1 className="fw-bold mb-2" style={{ fontSize: '1.8rem', color: 'var(--sh-text)' }}>
          Leaderboard
        </h1>
        <p className="mb-0" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>
          Kompetisi sehat — siapa yang paling rajin belajar?
        </p>
      </div>

      {/* My Rank Banner */}
      {currentUserRank && (
        <div className="mb-4 p-3 rounded-3 d-flex align-items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.25)',
          }}>
          <Avatar user={currentUserRank} size={44} />
          <div className="flex-grow-1">
            <div className="fw-semibold" style={{ fontSize: 14, color: 'var(--sh-text)' }}>
              Posisimu saat ini
            </div>
            <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>
              {currentUserRank.points.toLocaleString('id-ID')} poin
              {currentUserRank.streak > 0 && <> · 🔥 {currentUserRank.streak} hari streak</>}
              {currentUserRank.badges[0] && <> · {currentUserRank.badges[0]}</>}
            </div>
          </div>
          <div className="fw-bold" style={{ fontSize: 24, color: '#6366f1' }}>
            #{currentUserRank.rank}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: '#6366f1' }} />
          <p className="mt-3 mb-0" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>Memuat leaderboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-3 p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {error}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-trophy" style={{ fontSize: 48, color: 'var(--sh-muted)' }} />
          <p className="mt-3" style={{ fontSize: 14, color: 'var(--sh-muted)' }}>Belum ada pengguna. Jadilah yang pertama!</p>
        </div>
      ) : (
        <>
          {/* ── Podium ───────────────────────────────────────────── */}
          {users.length >= 1 && (
            <div className="mb-5">
              {/* Avatar row */}
              <div className="d-flex align-items-end justify-content-center gap-4 mb-0"
                style={{ paddingBottom: 0 }}>
                {podiumOrder.map((user, podiumIdx) => {
                  const cfg = podiumConfig[podiumIdx]
                  const isFirst = cfg.rank === 1
                  return (
                    <div key={user.id} className="d-flex flex-column align-items-center"
                      style={{ flex: 1, maxWidth: 200 }}>
                      {/* Crown for 1st */}
                      {isFirst && (
                        <div style={{ fontSize: 28, marginBottom: 4, animation: 'float 3s ease-in-out infinite' }}>
                          👑
                        </div>
                      )}
                      {/* Emoji medal */}
                      <div style={{ fontSize: isFirst ? 22 : 18, marginBottom: 6 }}>{cfg.emoji}</div>
                      {/* Avatar */}
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Avatar user={user} size={isFirst ? 68 : 52} />
                        {user.isCurrentUser && (
                          <div style={{
                            position: 'absolute', bottom: -2, right: -2,
                            background: '#6366f1', borderRadius: 999, width: 18, height: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <i className="bi bi-person-fill text-white" style={{ fontSize: 10 }} />
                          </div>
                        )}
                      </div>
                      {/* Name */}
                      <div className="text-truncate fw-semibold text-center w-100"
                        style={{ fontSize: isFirst ? 14 : 13, color: 'var(--sh-text)', maxWidth: 140 }}>
                        {user.name}{user.isCurrentUser ? ' 👤' : ''}
                      </div>
                      {/* Institution */}
                      {user.institution && (
                        <div className="text-truncate text-center w-100"
                          style={{ fontSize: 10, color: 'var(--sh-muted)', maxWidth: 140 }}>
                          {user.institution}
                        </div>
                      )}
                      {/* Points */}
                      <div className="fw-bold" style={{ fontSize: isFirst ? 18 : 15, color: '#6366f1', marginTop: 2 }}>
                        {user.points.toLocaleString('id-ID')}
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--sh-muted)', marginLeft: 3 }}>pts</span>
                      </div>
                      {user.streak > 0 && (
                        <div style={{ fontSize: 11, color: '#f59e0b' }}>🔥 {user.streak}d</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Podium bars */}
              <div className="d-flex align-items-end justify-content-center gap-4" style={{ height: 160 }}>
                {podiumOrder.map((user, podiumIdx) => {
                  const cfg = podiumConfig[podiumIdx]
                  const isFirst = cfg.rank === 1
                  return (
                    <div key={user.id + '_bar'} className="d-flex flex-column align-items-center justify-content-end"
                      style={{ flex: 1, maxWidth: 200 }}>
                      <div style={{
                        width: '100%',
                        height: cfg.height,
                        background: cfg.medalColor,
                        borderRadius: '16px 16px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isFirst ? '0 -8px 32px rgba(251,191,36,0.3)' : undefined,
                        transition: 'all 0.3s',
                      }}>
                        <span style={{
                          fontSize: isFirst ? 32 : 26,
                          fontWeight: 900,
                          color: 'rgba(255,255,255,0.85)',
                          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}>
                          {cfg.rank}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Podium base */}
              <div style={{
                height: 8,
                background: 'var(--sh-border)',
                borderRadius: '0 0 8px 8px',
                marginTop: 0,
              }} />
            </div>
          )}

          {/* ── Rest of Leaderboard ──────────────────────────────── */}
          {rest.length > 0 && (
            <div className="card overflow-hidden">
              {rest.map((user, idx) => (
                <div
                  key={user.id}
                  className="d-flex align-items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: idx < rest.length - 1 ? '1px solid var(--sh-border)' : 'none',
                    background: user.isCurrentUser ? 'rgba(99,102,241,0.06)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!user.isCurrentUser)
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (!user.isCurrentUser)
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  {/* Rank Number */}
                  <div className="text-center fw-bold" style={{ width: 32, fontSize: 15, color: 'var(--sh-muted)', flexShrink: 0 }}>
                    {user.rank}
                  </div>

                  <Avatar user={user} size={38} />

                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-semibold text-truncate" style={{ fontSize: 14, color: 'var(--sh-text)' }}>
                        {user.name}
                      </span>
                      {user.isCurrentUser && (
                        <span className="badge rounded-pill" style={{ fontSize: 9, background: '#6366f1', color: 'white' }}>
                          Kamu
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sh-muted)' }}>
                      {user.institution ?? 'Pelajar'}
                      {user.badges[0] && <> · {user.badges[0]}</>}
                    </div>
                  </div>

                  <div className="text-end" style={{ flexShrink: 0 }}>
                    <div className="fw-bold" style={{ fontSize: 14, color: '#6366f1' }}>
                      {user.points.toLocaleString('id-ID')} pts
                    </div>
                    {user.streak > 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>🔥 {user.streak}d</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
