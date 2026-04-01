'use client'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type PdfDoc = {
  id: string
  title: string
  fileName: string
  pageCount: number
  charCount: number
  status: 'PROCESSING' | 'READY' | 'ERROR'
  createdAt: string
  _count: { challenges: number }
}

function formatBytes(n: number) {
  if (n < 1000) return `${n} karakter`
  if (n < 1_000_000) return `${Math.round(n / 1000)}K karakter`
  return `${(n / 1_000_000).toFixed(1)}M karakter`
}

function StatusBadge({ status }: { status: PdfDoc['status'] }) {
  const cfg = {
    READY:      { cls: 'bg-success bg-opacity-10 text-success', icon: 'bi-check-circle-fill', label: 'Siap' },
    PROCESSING: { cls: 'bg-warning bg-opacity-10 text-warning', icon: 'bi-hourglass-split',  label: 'Memproses…' },
    ERROR:      { cls: 'bg-danger bg-opacity-10 text-danger',   icon: 'bi-x-circle-fill',    label: 'Gagal' },
  }[status]
  return (
    <span className={`badge rounded-pill px-2 py-1 ${cfg.cls}`} style={{ fontSize: 11 }}>
      <i className={`bi ${cfg.icon} me-1`} />{cfg.label}
    </span>
  )
}

export default function PdfLibraryPage() {
  const [docs, setDocs] = useState<PdfDoc[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [limit, setLimit] = useState(3)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/pdf')
      setDocs(data.docs)
      setIsPremium(data.isPremium)
      setLimit(data.limit)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async (file: File) => {
    if (!file) return
    setUploadError('')
    setUploading(true)
    setUploadProgress('Membaca file…')

    const formData = new FormData()
    formData.append('file', file)
    if (titleInput.trim()) formData.append('title', titleInput.trim())

    try {
      setUploadProgress('Mengekstrak teks PDF…')
      await new Promise((r) => setTimeout(r, 400))
      setUploadProgress('Merangkum dengan AI… (mungkin butuh 10–20 detik)')
      await axios.post('/api/pdf', formData)
      setTitleInput('')
      setUploadProgress('')
      await fetchDocs()
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Gagal upload. Coba lagi.'
      setUploadError(msg)
      if (err?.response?.data?.limitReached) {
        setUploadError(msg)
      }
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus "${title}"?`)) return
    await axios.delete(`/api/pdf/${id}`)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const canUpload = isPremium || docs.length < limit

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition" style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Header */}
          <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
            <div>
              <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
                <span style={{ fontSize: 22 }}>📄</span>
                PDF AI Assistant
                <span className="badge bg-primary ms-1" style={{ fontSize: 11, verticalAlign: 'middle' }}>Premium</span>
              </h5>
              <p className="text-muted small mb-0">
                Upload PDF kuliah/buku — AI otomatis merangkum, buat soal tantangan, dan siap menjawab pertanyaanmu
              </p>
            </div>
            {!isPremium && (
              <div className="badge rounded-3 px-3 py-2" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12 }}>
                {docs.length}/{limit} PDF digunakan
              </div>
            )}
          </div>

          {/* Upload area */}
          {canUpload && (
            <div
              className={`card mb-4 border-2 ${dragOver ? 'border-primary' : 'border-dashed'}`}
              style={{
                borderStyle: 'dashed',
                borderColor: dragOver ? '#6366f1' : '#cbd5e1',
                background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--sh-card-bg)',
                transition: 'all 0.2s',
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <div className="card-body text-center py-5">
                {uploading ? (
                  <>
                    <div className="spinner-border text-primary mb-3" style={{ width: 32, height: 32 }} />
                    <p className="mb-0 fw-semibold" style={{ fontSize: 14, color: '#6366f1' }}>{uploadProgress}</p>
                    <p className="text-muted small mb-0 mt-1">Jangan tutup halaman ini</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
                    <p className="fw-semibold mb-1" style={{ fontSize: 15 }}>Drag & drop PDF di sini</p>
                    <p className="text-muted small mb-3">atau klik untuk pilih file · Maks 10 MB</p>
                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Judul dokumen (opsional)"
                        value={titleInput}
                        onChange={(e) => { e.stopPropagation(); setTitleInput(e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 260 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                      >
                        <i className="bi bi-cloud-upload me-1" />Pilih PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!canUpload && !isPremium && (
            <div className="alert alert-warning d-flex align-items-center justify-content-between gap-3 mb-4 flex-wrap" style={{ borderRadius: 12 }}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: 24 }}>⭐</span>
                <div>
                  <strong>Batas PDF gratis tercapai ({limit}/{limit})</strong>
                  <p className="mb-0 small">Upgrade ke Premium untuk upload PDF tak terbatas dan fitur eksklusif lainnya.</p>
                </div>
              </div>
              <Link href="/upgrade" className="btn btn-warning btn-sm fw-bold" style={{ borderRadius: 10, whiteSpace: 'nowrap' }}>
                ⭐ Upgrade Premium
              </Link>
            </div>
          )}

          {uploadError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" style={{ borderRadius: 10 }}>
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{uploadError}</span>
              <button className="btn-close ms-auto" onClick={() => setUploadError('')} />
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />

          {/* Daftar PDF */}
          <h6 className="fw-bold mb-3" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sh-muted)' }}>
            Perpustakaan PDF Kamu ({docs.length})
          </h6>

          {loading ? (
            <div className="d-flex flex-column gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{ height: 76, background: 'var(--sh-card-bg)' }}>
                  <div className="card-body d-flex align-items-center gap-3">
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(148,163,184,0.15)', flexShrink: 0 }} />
                    <div className="flex-grow-1">
                      <div style={{ height: 12, borderRadius: 6, background: 'rgba(148,163,184,0.2)', width: '60%', marginBottom: 8 }} />
                      <div style={{ height: 10, borderRadius: 6, background: 'rgba(148,163,184,0.15)', width: '40%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <div style={{ fontSize: 52, marginBottom: 12 }}>📂</div>
              <p className="fw-semibold mb-1">Belum ada PDF yang diupload</p>
              <p className="small">Upload PDF pertamamu di atas dan biarkan AI bekerja!</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {docs.map((doc) => (
                <div key={doc.id} className="card" style={{ transition: 'box-shadow 0.15s' }}>
                  <div className="card-body d-flex align-items-center gap-3 py-3">
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      📄
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-bold text-truncate" style={{ fontSize: 14, maxWidth: 300 }}>{doc.title}</span>
                        <StatusBadge status={doc.status} />
                        {doc._count.challenges > 0 && (
                          <span className="badge bg-info bg-opacity-10 text-info rounded-pill px-2" style={{ fontSize: 10 }}>
                            {doc._count.challenges} soal
                          </span>
                        )}
                      </div>
                      <div className="text-muted small mt-1">
                        {doc.pageCount > 0 && <span>{doc.pageCount} hlm · </span>}
                        {doc.charCount > 0 && <span>{formatBytes(doc.charCount)} · </span>}
                        <span>{new Date(doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="d-flex gap-2 flex-shrink-0">
                      {doc.status === 'READY' && (
                        <Link href={`/pdf/${doc.id}`} className="btn btn-sm btn-primary">
                          <i className="bi bi-eye me-1" />Buka
                        </Link>
                      )}
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(doc.id, doc.title)}>
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
