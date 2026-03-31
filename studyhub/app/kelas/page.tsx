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
  const [joinResult, setJoinResult] = useState<{ok?: boolean, error?: string, groupName?: string}>({})

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
        body: JSON.stringify({ name: createName, description: createDesc, subject: createSubject })
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
        body: JSON.stringify({ inviteCode })
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
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h4 className="mb-1 fw-bold text-dark" style={{ letterSpacing: '-0.3px' }}>Daftar Kelas</h4>
          <p className="text-secondary mb-0 small fw-medium">Gabung kelas atau buat kelas untuk kelompokmu.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary shadow-sm btn-sm rounded-pill px-3 fw-bold" onClick={() => setShowJoinModal(true)}>
            <i className="bi bi-box-arrow-in-right me-2"></i>Gabung
          </button>
          <button className="btn btn-primary shadow-sm btn-sm rounded-pill px-3 fw-bold d-flex align-items-center" onClick={() => setShowCreateModal(true)} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none' }}>
            <i className="bi bi-plus-lg me-2"></i>Buat Kelas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-secondary fw-medium">
          <div className="spinner-border spinner-border-sm mb-2 text-primary" role="status"></div>
          <div>Memuat daftar kelas...</div>
        </div>
      ) : kelasList.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-people-fill d-block mb-3 text-secondary opacity-50" style={{ fontSize: '3rem' }}></i>
          <h5 className="fw-bold text-dark">Kamu belum bergabung di kelas apapun.</h5>
          <p className="text-secondary small fw-medium">Buat kelas baru sebagai komisaris atau gabung dengan kode undangan.</p>
          <button className="btn btn-primary mt-3 rounded-pill px-4 fw-bold shadow-sm" onClick={() => setShowJoinModal(true)} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}>
            <i className="bi bi-rocket-takeoff-fill me-2"></i> Gabung Sekarang
          </button>
        </div>
      ) : (
        <div className="row g-3">
          {kelasList.map(k => (
            <div key={k.id} className="col-12 col-md-6 col-lg-4">
              <Link href={`/kelas/${k.id}`} className="text-decoration-none">
                <div className="card h-100 border-0 shadow-sm" style={{ transition: 'transform 0.2s, box-shadow 0.2s', borderRadius: '20px', backgroundColor: 'var(--sh-card-bg)', border: '1px solid rgba(0,0,0,0.05)' }} onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }} onMouseOut={(e: any) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--bs-box-shadow-sm)' }}>
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="card-title text-truncate fw-bold mb-0 text-dark" style={{ maxWidth: '75%', fontSize: '1.1rem' }}>{k.name}</h5>
                      <span className={`badge ${k.role === 'ADMIN' ? 'bg-primary' : 'bg-light text-secondary border'} rounded-pill`} style={{ fontSize: '0.65rem', padding: '5px 10px' }}>
                        {k.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}
                      </span>
                    </div>
                    <div className="text-primary small fw-bold mb-3 d-flex align-items-center gap-1"><i className="bi bi-book-half"></i> {k.subject ? k.subject : 'Mata Kuliah Umum'}</div>
                    <p className="card-text text-secondary small fw-medium" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.6' }}>
                      {k.description || 'Deskripsi kelas belum ditambahkan oleh komisaris.'}
                    </p>
                    <div className="d-flex gap-3 small mt-auto pt-3 border-top" style={{ color: '#475569', fontWeight: 600 }}>
                      <div className="d-flex align-items-center gap-1 px-2 py-1 bg-light rounded-pill"><i className="bi bi-people-fill text-primary"></i>{k.memberCount}</div>
                      <div className="d-flex align-items-center gap-1 px-2 py-1 bg-light rounded-pill"><i className="bi bi-journal-bookmark-fill text-warning"></i>{k.taskCount}</div>
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
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">Buat Kelas Baru</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Nama Kelas (wajib)</label>
                    <input type="text" className="form-control form-control-sm border-secondary" value={createName} onChange={e => setCreateName(e.target.value)} required placeholder="Contoh: IF-C-Sore 2024" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Deskripsi</label>
                    <textarea className="form-control form-control-sm border-secondary" value={createDesc} onChange={e => setCreateDesc(e.target.value)} rows={3} placeholder="Deskripsi singkat kelas ini..."></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Grup / Jurusan</label>
                    <input type="text" className="form-control form-control-sm border-secondary" value={createSubject} onChange={e => setCreateSubject(e.target.value)} placeholder="Contoh: Teknik Informatika" />
                  </div>
                  <div className="text-muted small">
                    <i className="bi bi-info-circle me-1"></i>Kamu akan menjadi <strong>Komisaris (Admin)</strong> kelas ini.
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light btn-sm px-3 rounded-pill" onClick={() => setShowCreateModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 rounded-pill" disabled={creating || !createName.trim()}>
                    {creating ? 'Membuat...' : 'Buat Kelas'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gabung Kelas */}
      {showJoinModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">Gabung Kelas</h5>
                <button type="button" className="btn-close" onClick={() => setShowJoinModal(false)}></button>
              </div>
              <form onSubmit={handleJoin}>
                <div className="modal-body pt-3">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Kode Undangan</label>
                    <input type="text" className="form-control form-control-sm border-secondary" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required placeholder="Masukkan kode dari komisaris" autoFocus />
                  </div>
                  {joinResult.error && <div className="alert alert-danger p-2 small m-0 rounded-3 mb-2">{joinResult.error}</div>}
                  {joinResult.ok && <div className="alert alert-success p-2 small m-0 rounded-3 mb-2">Berhasil gabung ke kelas {joinResult.groupName}!</div>}
                  {joinResult.ok && <div className="text-center small mt-2">Mengalihkan...</div>}
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light btn-sm px-3 rounded-pill" onClick={() => setShowJoinModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 rounded-pill" disabled={joining || !inviteCode.trim() || !!joinResult.ok}>
                    {joining ? 'Mengecek...' : 'Gabung'}
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
