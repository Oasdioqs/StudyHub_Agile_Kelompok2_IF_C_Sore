'use client'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { upload as blobUpload } from '@vercel/blob/client'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'
import { inferDocumentKind, maxClientDocumentUploadBytes } from '@/lib/document-kind'

type PdfDoc = {
  id: string
  title: string
  fileName: string
  fileKind?: string
  pageCount: number
  charCount: number
  status: 'PROCESSING' | 'READY' | 'ERROR'
  createdAt: string
  _count: { challenges: number }
}

function docKindIcon(kind: string | undefined) {
  const k = kind ?? 'pdf'
  if (k === 'docx') return { icon: 'bi-file-earmark-word', color: '#2563eb', label: 'Word' }
  if (k === 'pptx') return { icon: 'bi-file-earmark-slides', color: '#ea580c', label: 'PPT' }
  return { icon: 'bi-file-earmark-pdf', color: '#ef4444', label: 'PDF' }
}

function formatBytes(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x) || x <= 0) return '0 karakter'
  if (x < 1000) return `${Math.round(x)} karakter`
  if (x < 1_000_000) return `${Math.round(x / 1000)}K karakter`
  return `${(x / 1_000_000).toFixed(1)}M karakter`
}

function normalizeApiDoc(raw: unknown): PdfDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  if (typeof d.id !== 'string') return null
  const st = typeof d.status === 'string' ? d.status : 'READY'
  const safeStatus = st === 'READY' || st === 'PROCESSING' || st === 'ERROR' ? st : 'READY'
  const c = d._count && typeof d._count === 'object' && d._count !== null
    ? (d._count as { challenges?: unknown }).challenges
    : 0
  const ch = typeof c === 'number' && Number.isFinite(c) ? c : 0
  const fn = typeof d.fileName === 'string' ? d.fileName : ''
  return {
    id: d.id,
    title: typeof d.title === 'string' ? d.title : 'Tanpa judul',
    fileName: fn,
    fileKind: typeof d.fileKind === 'string' ? d.fileKind : inferDocumentKind(fn),
    pageCount: typeof d.pageCount === 'number' ? d.pageCount : 0,
    charCount: typeof d.charCount === 'number' ? d.charCount : 0,
    status: safeStatus,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
    _count: { challenges: ch },
  }
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    READY:      { cls: 'bg-success bg-opacity-10 text-success', icon: 'bi-check-circle-fill', label: 'Siap' },
    PROCESSING: { cls: 'bg-warning bg-opacity-10 text-warning', icon: 'bi-hourglass-split',  label: 'Memproses…' },
    ERROR:      { cls: 'bg-danger bg-opacity-10 text-danger',   icon: 'bi-x-circle-fill',    label: 'Gagal' },
  } as const
  const cfg = map[status as keyof typeof map] ?? {
    cls: 'bg-secondary bg-opacity-10 text-secondary',
    icon: 'bi-question-circle-fill',
    label: status || '?',
  }
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
  const [lifetimeUsed, setLifetimeUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [blobUploadEnabled, setBlobUploadEnabled] = useState(false)
  const [maxFormBytes, setMaxFormBytes] = useState(() => maxClientDocumentUploadBytes())
  const [maxLargeBytes, setMaxLargeBytes] = useState(() => maxClientDocumentUploadBytes())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/pdf')
      const rawList = Array.isArray(data?.docs) ? data.docs : []
      setDocs(
        rawList
          .map(normalizeApiDoc)
          .filter((x: PdfDoc | null): x is PdfDoc => x !== null),
      )
      setIsPremium(Boolean(data?.isPremium))
      setLimit(typeof data?.limit === 'number' ? data.limit : 3)
      setLifetimeUsed(typeof data?.lifetimeUsed === 'number' ? data.lifetimeUsed : 0)
      const blobOn = Boolean(data?.blobUpload)
      setBlobUploadEnabled(blobOn)
      const mf = typeof data?.maxFormUploadBytes === 'number' ? data.maxFormUploadBytes : maxClientDocumentUploadBytes()
      const ml = typeof data?.maxLargeUploadBytes === 'number' ? data.maxLargeUploadBytes : mf
      setMaxFormBytes(mf)
      setMaxLargeBytes(ml)
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [])

  const uploadCapLabel = () =>
    `${(maxLargeBytes / 1024 / 1024).toFixed(0)} MB`

  const handleUpload = async (file: File) => {
    if (!file) return
    setUploadError('')
    if (file.size > maxLargeBytes) {
      setUploadError(
        `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal ${uploadCapLabel()}${blobUploadEnabled ? '' : ' (aktifkan Vercel Blob untuk hingga ~80 MB)'}.`,
      )
      return
    }
    setUploading(true)
    setUploadProgress('Membaca file…')

    const useBlob = blobUploadEnabled && file.size > maxFormBytes

    try {
      if (useBlob) {
        const safe =
          `studyhub-pdf/${Date.now()}-` +
          file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120)
        setUploadProgress('Mengunggah ke penyimpanan…')
        const put = await blobUpload(safe, file, {
          access: 'public',
          handleUploadUrl: '/api/pdf/blob-upload',
          multipart: file.size >= 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => {
            setUploadProgress(`Mengunggah ${Math.round(percentage)}%…`)
          },
        })
        setUploadProgress('Mengekstrak teks dokumen…')
        await new Promise((r) => setTimeout(r, 200))
        setUploadProgress('Merangkum dengan AI… (mungkin butuh 10–20 detik)')
        await axios.post('/api/pdf', {
          fromBlobUrl: put.url,
          fileName: file.name,
          ...(titleInput.trim() ? { title: titleInput.trim() } : {}),
          ...(file.type ? { mimeType: file.type } : {}),
        })
      } else {
        if (file.size > maxFormBytes) {
          setUploadError(
            `File ini ${(file.size / 1024 / 1024).toFixed(1)} MB. Tanpa Vercel Blob, batas lewat form adalah ${(maxFormBytes / 1024 / 1024).toFixed(0)} MB. ` +
              'Hubungkan Blob store di Vercel dan set BLOB_READ_WRITE_TOKEN, lalu deploy ulang.',
          )
          return
        }
        const formData = new FormData()
        formData.append('file', file)
        if (titleInput.trim()) formData.append('title', titleInput.trim())
        setUploadProgress('Mengekstrak teks dokumen…')
        await new Promise((r) => setTimeout(r, 400))
        setUploadProgress('Merangkum dengan AI… (mungkin butuh 10–20 detik)')
        await axios.post('/api/pdf', formData)
      }
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

  const canUpload = isPremium || lifetimeUsed < limit

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition" style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Header */}
          <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
            <div>
              <h5 className="fw-bold mb-1 d-flex align-items-center gap-2 flex-wrap">
                <span style={{ fontSize: 22 }}>📚</span>
                Dokumen AI
                <span className="badge bg-primary ms-1" style={{ fontSize: 11, verticalAlign: 'middle' }}>Premium</span>
              </h5>
              <p className="text-muted small mb-0">
                Upload <strong>PDF</strong>, <strong>Word (.docx)</strong>, atau <strong>PowerPoint (.pptx)</strong> — AI merangkum, buat tantangan, dan jawab pertanyaanmu
              </p>
            </div>
            {!isPremium && (
              <div className="badge rounded-3 px-3 py-2" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12 }}>
                {lifetimeUsed}/{limit} slot dokumen (seumur hidup)
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
                    <p className="fw-semibold mb-1" style={{ fontSize: 15 }}>Drag & drop file di sini</p>
                    <p className="text-muted small mb-3">
                      PDF · DOCX · PPTX · Maks {uploadCapLabel()}
                      {blobUploadEnabled
                        ? ` (file di atas ~${(maxFormBytes / 1024 / 1024).toFixed(0)} MB lewat unggahan langsung ke Blob).`
                        : ' — file besar: tambah Vercel Blob + BLOB_READ_WRITE_TOKEN (~80 MB).'}
                    </p>
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
                        <i className="bi bi-cloud-upload me-1" />Pilih file
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
                  <strong>Batas dokumen gratis tercapai ({limit}/{limit})</strong>
                  <p className="mb-0 small">Upgrade ke Premium untuk upload dokumen tak terbatas dan fitur eksklusif lainnya.</p>
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Daftar dokumen */}
          <h6 className="fw-bold mb-3" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--sh-muted)' }}>
            Perpustakaan dokumen ({docs.length})
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
              <p className="fw-semibold mb-1">Belum ada dokumen yang diupload</p>
              <p className="small">Upload PDF, Word, atau PPTX pertamamu di atas dan biarkan AI bekerja!</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {docs.map((doc) => {
                const dk = docKindIcon(doc.fileKind ?? inferDocumentKind(doc.fileName))
                return (
                <div key={doc.id} className="card" style={{ transition: 'box-shadow 0.15s' }}>
                  <div className="card-body d-flex align-items-center gap-3 py-3">
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${dk.color}18`, border: `1px solid ${dk.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`bi ${dk.icon}`} style={{ fontSize: 22, color: dk.color }} />
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-bold text-truncate" style={{ fontSize: 14, maxWidth: 300 }}>{doc.title}</span>
                        <span className="badge rounded-pill px-2 py-0" style={{ fontSize: 9, fontWeight: 800, background: `${dk.color}22`, color: dk.color }}>{dk.label}</span>
                        <StatusBadge status={doc.status} />
                        {(doc._count?.challenges ?? 0) > 0 && (
                          <span className="badge bg-info bg-opacity-10 text-info rounded-pill px-2" style={{ fontSize: 10 }}>
                            {doc._count?.challenges ?? 0} soal
                          </span>
                        )}
                      </div>
                      <div className="text-muted small mt-1">
                        {doc.pageCount > 0 && (
                          <span>{doc.pageCount} {(doc.fileKind ?? 'pdf') === 'pptx' ? 'slide' : 'hlm'} · </span>
                        )}
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
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
