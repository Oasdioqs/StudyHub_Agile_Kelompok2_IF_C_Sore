'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Kelas = {
  id: string
  name: string
  description: string | null
  subject: string | null
  role: 'ADMIN' | 'MEMBER'
  joinedAt: string
  memberCount: number
  taskCount: number
}

function SkeletonCard() {
  return (
    <div className="col-12 col-md-6 col-lg-4">
      <div className="skeleton-card">
        <div className="skeleton-line w-60 mb-2" />
        <div className="skeleton-line w-40 mb-3" />
        <div className="skeleton-line w-90 mb-1" />
        <div className="skeleton-line w-70 mb-4" />
        <div className="skeleton-line w-50" />
      </div>
    </div>
  )
}

export default function KelasIndex() {
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  // Create Form
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createSubject, setCreateSubject] = useState('')
  const [creating, setCreating] = useState(false)

  // Join Form
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinResult, setJoinResult] = useState<{ ok?: boolean; error?: string; groupName?: string }>({})

  useEffect(() => {
    fetchKelas()
  }, [])

  const fetchKelas = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kelas')
      const data = await res.json()
      if (Array.isArray(data)) setKelasList(data)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, description: createDesc, subject: createSubject }),
      })
      if (res.ok) {
        setShowCreateModal(false)
        setCreateName('')
        setCreateDesc('')
        setCreateSubject('')
        fetchKelas()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoining(true)
    try {
      const res = await fetch('/api/kelas/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      })
      const data = await res.json()
      setJoinResult(data)
      if (res.ok) {
        setTimeout(() => {
          setShowJoinModal(false)
          setJoinResult({})
          fetchKelas()
        }, 1500)
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="kelas-header mb-4">
        <div>
          <h4 className="kelas-heading">Daftar Kelas</h4>
          <p className="kelas-subheading">Gabung kelas atau buat kelas untuk kelompokmu.</p>
        </div>
        <div className="kelas-header-actions">
          <button className="kelas-btn-secondary" onClick={() => setShowJoinModal(true)}>
            <i className="bi bi-box-arrow-in-right" />
            <span className="kelas-btn-text">Gabung</span>
          </button>
          <button className="kelas-btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="bi bi-plus-lg" />
            <span className="kelas-btn-text">Buat Kelas</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="row g-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : kelasList.length === 0 ? (
        <div className="kelas-empty animate-fade-up">
          <div className="kelas-empty-icon empty-state-icon">
            <i className="bi bi-people-fill" />
          </div>
          <h5 className="kelas-empty-title">Kamu belum bergabung di kelas apapun.</h5>
          <p className="kelas-empty-sub">Buat kelas baru sebagai komisaris atau gabung dengan kode undangan.</p>
          <button className="kelas-btn-accent mt-3" onClick={() => setShowJoinModal(true)}>
            <i className="bi bi-rocket-takeoff-fill me-2" />
            Gabung Sekarang
          </button>
        </div>
      ) : (
        <div className="row g-3">
          {kelasList.map((k, idx) => (
            <div
              key={k.id}
              className={`col-12 col-md-6 col-lg-4 animate-fade-up stagger-${Math.min(idx + 1, 6)}`}
            >
              <Link href={`/kelas/${k.id}`} className="text-decoration-none">
                <div className={`kelas-card ${k.role === 'ADMIN' ? 'kelas-card-admin' : ''}`}>
                  <div className="kelas-card-top">
                    <div className="kelas-card-avatar">
                      {k.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`kelas-role-badge ${k.role === 'ADMIN' ? 'admin' : 'member'}`}>
                      {k.role === 'ADMIN' ? (
                        <><i className="bi bi-shield-check" /> Komisaris</>
                      ) : (
                        <><i className="bi bi-person" /> Anggota</>
                      )}
                    </span>
                  </div>
                  <h5 className="kelas-card-title">{k.name}</h5>
                  <div className="kelas-card-subject">
                    <i className="bi bi-book-half" />
                    {k.subject || 'Mata Kuliah Umum'}
                  </div>
                  <p className="kelas-card-desc">
                    {k.description || 'Deskripsi kelas belum ditambahkan oleh komisaris.'}
                  </p>
                  <div className="kelas-card-stats">
                    <div className="kelas-stat">
                      <i className="bi bi-people-fill" />
                      <span>{k.memberCount} anggota</span>
                    </div>
                    <div className="kelas-stat">
                      <i className="bi bi-journal-bookmark-fill" />
                      <span>{k.taskCount} tugas</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal Buat Kelas */}
      {showCreateModal && (
        <div className="kelas-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="kelas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kelas-modal-header">
              <div>
                <h5 className="kelas-modal-title">Buat Kelas Baru</h5>
                <p className="kelas-modal-sub">Kamu akan menjadi <strong>Komisaris (Admin)</strong></p>
              </div>
              <button className="kelas-modal-close" onClick={() => setShowCreateModal(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="kelas-modal-body">
                <div className="kelas-form-group">
                  <label>Nama Kelas <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    placeholder="Contoh: IF-C-Sore 2024"
                  />
                </div>
                <div className="kelas-form-group">
                  <label>Deskripsi</label>
                  <textarea
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={3}
                    placeholder="Deskripsi singkat kelas ini..."
                  />
                </div>
                <div className="kelas-form-group">
                  <label>Grup / Jurusan</label>
                  <input
                    type="text"
                    value={createSubject}
                    onChange={(e) => setCreateSubject(e.target.value)}
                    placeholder="Contoh: Teknik Informatika"
                  />
                </div>
              </div>
              <div className="kelas-modal-footer">
                <button type="button" className="kelas-modal-cancel" onClick={() => setShowCreateModal(false)}>Batal</button>
                <button type="submit" className="kelas-btn-primary" disabled={creating || !createName.trim()}>
                  {creating ? <><span className="kelas-spin" /> Membuat...</> : 'Buat Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gabung Kelas */}
      {showJoinModal && (
        <div className="kelas-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="kelas-modal kelas-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="kelas-modal-header">
              <div>
                <h5 className="kelas-modal-title">Gabung Kelas</h5>
                <p className="kelas-modal-sub">Masukkan kode undangan dari komisaris</p>
              </div>
              <button className="kelas-modal-close" onClick={() => setShowJoinModal(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <form onSubmit={handleJoin}>
              <div className="kelas-modal-body">
                <div className="kelas-form-group">
                  <label>Kode Undangan</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    placeholder="Masukkan kode dari komisaris"
                    autoFocus
                    style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  />
                </div>
                {joinResult.error && (
                  <div className="kelas-alert error">
                    <i className="bi bi-exclamation-triangle-fill me-2" />{joinResult.error}
                  </div>
                )}
                {joinResult.ok && (
                  <div className="kelas-alert success">
                    <i className="bi bi-check-circle-fill me-2" />Berhasil gabung ke kelas <strong>{joinResult.groupName}</strong>!
                  </div>
                )}
              </div>
              <div className="kelas-modal-footer">
                <button type="button" className="kelas-modal-cancel" onClick={() => setShowJoinModal(false)}>Batal</button>
                <button
                  type="submit"
                  className="kelas-btn-primary"
                  disabled={joining || !inviteCode.trim() || !!joinResult.ok}
                >
                  {joining ? <><span className="kelas-spin" /> Mengecek...</> : joinResult.ok ? <><i className="bi bi-check2 me-1" /> Berhasil!</> : 'Gabung'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Header ──────────────────────────────────────── */
        .kelas-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--sh-border);
          flex-wrap: wrap;
        }
        .kelas-heading {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--sh-text);
          margin: 0 0 4px;
          letter-spacing: -0.4px;
        }
        .kelas-subheading {
          font-size: 0.85rem;
          color: var(--sh-muted);
          font-weight: 500;
          margin: 0;
        }
        .kelas-header-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        /* ── Buttons ─────────────────────────────────────── */
        .kelas-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .kelas-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(79,70,229,0.35);
        }
        .kelas-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .kelas-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 999px;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .kelas-btn-secondary:hover {
          border-color: #4f46e5;
          color: #4f46e5;
          background: #eef2ff;
        }

        .kelas-btn-accent {
          display: inline-flex;
          align-items: center;
          padding: 10px 24px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .kelas-btn-accent:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16,185,129,0.35);
        }

        @media (max-width: 480px) {
          .kelas-btn-text { display: none; }
          .kelas-btn-primary, .kelas-btn-secondary {
            padding: 9px 13px;
          }
        }

        /* ── Skeleton ────────────────────────────────────── */
        .skeleton-card {
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 20px;
          padding: 20px;
          animation: fadeInUp 0.4s ease both;
        }
        .skeleton-line {
          height: 14px;
          border-radius: 8px;
          background: linear-gradient(90deg, var(--sh-border) 25%, rgba(0,0,0,0.04) 50%, var(--sh-border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          margin-bottom: 6px;
        }
        .w-40 { width: 40%; }
        .w-50 { width: 50%; }
        .w-60 { width: 60%; }
        .w-70 { width: 70%; }
        .w-90 { width: 90%; }

        /* ── Empty ───────────────────────────────────────── */
        .kelas-empty {
          text-align: center;
          padding: 60px 20px;
          animation: fadeInUp 0.4s ease;
        }
        .kelas-empty-icon {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          font-size: 2.2rem;
          color: #6366f1;
        }
        .kelas-empty-title { font-size: 1.1rem; font-weight: 800; color: var(--sh-text); margin-bottom: 8px; }
        .kelas-empty-sub { font-size: 0.9rem; color: var(--sh-muted); font-weight: 500; }

        /* ── Cards ───────────────────────────────────────── */
        .kelas-card {
          background: var(--sh-card-bg);
          border: 1.5px solid var(--sh-border);
          border-radius: 20px;
          padding: 20px;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          animation: fadeInUp 0.4s ease both;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .kelas-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--sh-border), transparent);
          transition: background 0.3s ease;
        }
        .kelas-card-admin::before {
          background: linear-gradient(90deg, #4f46e5, #7c3aed, #a78bfa);
        }
        .kelas-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.1);
          border-color: rgba(79,70,229,0.3);
        }

        .kelas-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .kelas-card-avatar {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem;
          font-weight: 800;
          flex-shrink: 0;
        }
        .kelas-role-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .kelas-role-badge.admin { background: #eef2ff; color: #4f46e5; }
        .kelas-role-badge.member { background: #f1f5f9; color: #64748b; border: 1px solid var(--sh-border); }

        .kelas-card-title {
          font-size: 1rem;
          font-weight: 800;
          color: var(--sh-text);
          margin: 4px 0 0;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .kelas-card-subject {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #4f46e5;
        }
        .kelas-card-desc {
          font-size: 0.82rem;
          color: var(--sh-muted);
          font-weight: 500;
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
        }
        .kelas-card-stats {
          display: flex;
          gap: 10px;
          padding-top: 12px;
          border-top: 1px solid var(--sh-border);
          margin-top: 4px;
        }
        .kelas-stat {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--sh-muted);
          background: var(--sh-bg);
          padding: 4px 10px;
          border-radius: 999px;
        }
        .kelas-stat i { font-size: 0.85rem; color: #4f46e5; }

        /* ── Modals ──────────────────────────────────────── */
        .kelas-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(6px);
          z-index: 1050;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: fadeIn 0.2s ease;
        }
        .kelas-modal {
          background: var(--sh-card-bg);
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.2);
          animation: modalIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          overflow: hidden;
        }
        .kelas-modal-sm { max-width: 380px; }
        .kelas-modal-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 20px 0;
          gap: 12px;
        }
        .kelas-modal-title { font-size: 1.05rem; font-weight: 800; color: var(--sh-text); margin: 0 0 2px; }
        .kelas-modal-sub { font-size: 0.8rem; color: var(--sh-muted); font-weight: 500; margin: 0; }
        .kelas-modal-close {
          width: 32px; height: 32px;
          border-radius: 50%; border: 1px solid var(--sh-border);
          background: var(--sh-bg);
          color: var(--sh-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 13px;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }
        .kelas-modal-close:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
        .kelas-modal-body { padding: 16px 20px; }
        .kelas-modal-footer {
          display: flex; align-items: center; justify-content: flex-end; gap: 10px;
          padding: 12px 20px 20px;
        }
        .kelas-modal-cancel {
          padding: 9px 20px;
          border-radius: 999px;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-bg);
          color: var(--sh-muted);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .kelas-modal-cancel:hover { background: #f1f5f9; }

        .kelas-form-group {
          margin-bottom: 14px;
        }
        .kelas-form-group label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--sh-text);
          margin-bottom: 6px;
        }
        .kelas-form-group input,
        .kelas-form-group textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid var(--sh-border);
          border-radius: 12px;
          background: var(--sh-bg);
          color: var(--sh-text);
          font-size: 0.875rem;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .kelas-form-group input:focus,
        .kelas-form-group textarea:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
        }

        .kelas-alert {
          display: flex; align-items: center;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .kelas-alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .kelas-alert.success { background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }

        /* ── Spinner ─────────────────────────────────────── */
        .kelas-spin {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* ── Animations ──────────────────────────────────── */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
