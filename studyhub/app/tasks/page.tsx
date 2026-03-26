'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

type Task = {
  id: string; title: string; description?: string
  deadline?: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'; subject?: string
  createdAt: string
}

const priorityLabel = { HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah' }
const statusLabel = { TODO: 'Belum', IN_PROGRESS: 'Proses', DONE: 'Selesai' }

export default function TasksPage() {
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', priority: '', q: '' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', deadline: '', priority: 'MEDIUM', subject: '' })
  const [saving, setSaving] = useState(false)

  const fetchTasks = async (withLoading = true) => {
    if (withLoading) setLoading(true)
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.priority) params.set('priority', filter.priority)
    if (filter.q.trim()) params.set('q', filter.q.trim())
    const { data } = await axios.get(`/api/tasks?${params}`)
    const qLower = filter.q.trim().toLowerCase()
    const filtered = qLower
      ? (data as Task[]).filter((task) =>
          [task.title, task.description ?? '', task.subject ?? '']
            .join(' ')
            .toLowerCase()
            .includes(qLower)
        )
      : data
    setTasks(filtered)
    if (withLoading) setLoading(false)
  }

  useEffect(() => {
    const status = searchParams.get('status') ?? ''
    const priority = searchParams.get('priority') ?? ''
    const q = searchParams.get('q') ?? ''
    setFilter((prev) =>
      prev.status === status && prev.priority === priority && prev.q === q ? prev : { status, priority, q }
    )
  }, [searchParams])

  useEffect(() => { fetchTasks(true) }, [filter])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data } = await axios.post('/api/tasks', form)
    setTasks(prev => [data, ...prev])
    setSaving(false)
    setShowModal(false)
    setForm({ title: '', description: '', deadline: '', priority: 'MEDIUM', subject: '' })
    fetchTasks(false)
  }

  const handleStatus = async (id: string, status: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status: status as Task['status'] } : t)))
    await axios.patch(`/api/tasks/${id}`, { status })
    fetchTasks(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus tugas ini?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    await axios.delete(`/api/tasks/${id}`)
    fetchTasks(false)
  }

  const priorityBadge: Record<string, string> = {
    HIGH: 'bg-danger bg-opacity-10 text-danger',
    MEDIUM: 'bg-warning bg-opacity-10 text-warning',
    LOW: 'bg-success bg-opacity-10 text-success',
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="p-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h5 className="fw-bold mb-0">Manajemen Tugas</h5>
              <p className="text-muted small mb-0">{tasks.length} tugas total</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <i className="bi bi-plus-circle me-2"></i>Tambah Tugas
            </button>
          </div>

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body py-3 d-flex gap-3 flex-wrap align-items-center">
              <div className="d-flex align-items-center gap-2">
                <label className="small fw-semibold text-muted">Status:</label>
                <select className="form-select form-select-sm" style={{ width: 'auto' }}
                  value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                  <option value="">Semua</option>
                  <option value="TODO">Belum Mulai</option>
                  <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                  <option value="DONE">Selesai</option>
                </select>
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="small fw-semibold text-muted">Prioritas:</label>
                <select className="form-select form-select-sm" style={{ width: 'auto' }}
                  value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })}>
                  <option value="">Semua</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="LOW">Rendah</option>
                </select>
              </div>
            </div>
          </div>

          {/* Task list */}
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-primary mb-3"></div>
              <p className="mb-0">Memuat tugas...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox" style={{ fontSize: 48 }}></i>
              <p className="mt-3 mb-2 fw-semibold">Belum ada tugas</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                Tambah Tugas Pertama
              </button>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {tasks.map((task) => (
                <div key={task.id} className="card">
                  <div className="card-body d-flex align-items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      className="form-check-input mt-1 flex-shrink-0"
                      checked={task.status === 'DONE'}
                      onChange={() => handleStatus(task.id, task.status === 'DONE' ? 'TODO' : 'DONE')}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={`fw-semibold ${task.status === 'DONE' ? 'text-decoration-line-through text-muted' : ''}`}
                          style={{ fontSize: 14 }}>
                          {task.title}
                        </span>
                        <span className={`badge rounded-pill px-2 ${priorityBadge[task.priority]}`}
                          style={{ fontSize: 11 }}>
                          {priorityLabel[task.priority]}
                        </span>
                        {task.subject && (
                          <span className="badge bg-light text-muted" style={{ fontSize: 11 }}>
                            {task.subject}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-muted mb-0 mt-1 text-truncate" style={{ fontSize: 13 }}>
                          {task.description}
                        </p>
                      )}
                      {task.deadline && (
                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                          <i className="bi bi-calendar2 me-1"></i>
                          {new Date(task.deadline).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 'auto', fontSize: 12 }}
                        value={task.status}
                        onChange={(e) => handleStatus(task.id, e.target.value)}>
                        <option value="TODO">Belum</option>
                        <option value="IN_PROGRESS">Proses</option>
                        <option value="DONE">Selesai</option>
                      </select>
                      <button className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(task.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header border-0 pb-0">
                    <h6 className="modal-title fw-bold">Tambah Tugas Baru</h6>
                    <button className="btn-close" onClick={() => setShowModal(false)}></button>
                  </div>
                  <form onSubmit={handleCreate}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label fw-semibold small">Judul Tugas *</label>
                        <input className="form-control" placeholder="Contoh: Kerjakan soal latihan bab 3"
                          value={form.title}
                          onChange={e => setForm({ ...form, title: e.target.value })} required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold small">Deskripsi</label>
                        <textarea className="form-control" rows={2}
                          placeholder="Detail tugas (opsional)"
                          value={form.description}
                          onChange={e => setForm({ ...form, description: e.target.value })} />
                      </div>
                      <div className="row g-3">
                        <div className="col-6">
                          <label className="form-label fw-semibold small">Mata Pelajaran</label>
                          <input className="form-control" placeholder="Matematika"
                            value={form.subject}
                            onChange={e => setForm({ ...form, subject: e.target.value })} />
                        </div>
                        <div className="col-6">
                          <label className="form-label fw-semibold small">Prioritas</label>
                          <select className="form-select" value={form.priority}
                            onChange={e => setForm({ ...form, priority: e.target.value })}>
                            <option value="HIGH">Tinggi</option>
                            <option value="MEDIUM">Sedang</option>
                            <option value="LOW">Rendah</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold small">Deadline</label>
                          <input type="datetime-local" className="form-control"
                            value={form.deadline}
                            onChange={e => setForm({ ...form, deadline: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer border-0 pt-0">
                      <button type="button" className="btn btn-light"
                        onClick={() => setShowModal(false)}>Batal</button>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Menyimpan...</> : 'Simpan Tugas'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
