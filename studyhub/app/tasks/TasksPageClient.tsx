'use client'

import { formatRemainingBeforeDeadline } from '@/lib/activity-metrics'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type Task = {
  id: string; title: string; description?: string
  deadline?: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'; subject?: string
  createdAt: string
}

const priorityLabel = { HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah' }
const statusLabel = { TODO: 'Belum Mulai', IN_PROGRESS: 'Sedang Dikerjakan', DONE: 'Selesai' }

const JAKARTA_TZ = 'Asia/Jakarta'

function getJakartaYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '0'
  const m = parts.find((p) => p.type === 'month')?.value ?? '0'
  const day = parts.find((p) => p.type === 'day')?.value ?? '0'
  return `${y}-${m}-${day}`
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

/** Selisih hari kalender (deadline − hari ini) di zona Jakarta */
function dayDiffFromToday(todayKey: string, deadlineKey: string): number {
  const a = parseYmd(todayKey)
  const b = parseYmd(deadlineKey)
  const t0 = Date.UTC(a.y, a.m - 1, a.d)
  const t1 = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((t1 - t0) / 86400000)
}

function formatJakartaDateLabel(d: Date, withWeekday: boolean) {
  return d.toLocaleDateString('id-ID', {
    weekday: withWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: JAKARTA_TZ,
  })
}

type TaskBucket = { key: string; label: string; sort: number }

function getTaskBucket(task: Task, todayKey: string, viewFilter: 'forthcoming' | 'overdue' | 'completed'): TaskBucket {
  if (!task.deadline) {
    return { key: 'no-deadline', label: 'Tanpa deadline', sort: 50_000 }
  }
  const d = new Date(task.deadline)
  if (Number.isNaN(d.getTime())) {
    return { key: 'no-deadline', label: 'Tanpa deadline', sort: 50_000 }
  }

  const dk = getJakartaYmd(d)
  const diff = dayDiffFromToday(todayKey, dk)

  if (viewFilter === 'overdue') {
    const label = `Lewat · ${formatJakartaDateLabel(d, true)}`
    return { key: `overdue-${dk}`, label, sort: diff }
  }

  if (diff < 0) {
    const label = `Lewat · ${formatJakartaDateLabel(d, true)}`
    return { key: `past-${dk}`, label, sort: 1000 + diff }
  }
  if (diff === 0) return { key: 'd0', label: 'Hari ini', sort: 0 }
  if (diff === 1) return { key: 'd1', label: 'Besok', sort: 1 }
  if (diff === 2) return { key: 'd2', label: 'Lusa', sort: 2 }
  if (diff > 2) {
    const label = formatJakartaDateLabel(d, true)
    return { key: `f-${dk}`, label, sort: 100 + diff }
  }
  return { key: 'other', label: 'Lainnya', sort: 40_000 }
}

function sortTasksByDeadlineThenCreated<T extends { deadline?: string; createdAt?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY
    const bd = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY
    if (ad !== bd) return ad - bd
    const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bc - ac
  })
}

type TaskGroup = { key: string; label: string; tasks: Task[] }

function groupVisibleTasks(
  tasks: Task[],
  viewFilter: 'forthcoming' | 'overdue' | 'completed',
  todayKey: string,
): TaskGroup[] {
  const sorted = sortTasksByDeadlineThenCreated(tasks)
  const bucketMap = new Map<string, { label: string; sort: number; tasks: Task[] }>()

  for (const task of sorted) {
    const b = getTaskBucket(task, todayKey, viewFilter)
    const prev = bucketMap.get(b.key)
    if (prev) {
      prev.tasks.push(task)
    } else {
      bucketMap.set(b.key, { label: b.label, sort: b.sort, tasks: [task] })
    }
  }

  const groups = Array.from(bucketMap.entries()).map(([key, v]) => ({
    key,
    label: v.label,
    sort: v.sort,
    tasks: v.tasks,
  }))

  return groups.sort((a, b) => a.sort - b.sort).map(({ key, label, tasks: t }) => ({ key, label, tasks: t }))
}

export default function TasksPageClient() {
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [viewFilter, setViewFilter] = useState<'forthcoming' | 'overdue' | 'completed'>('forthcoming')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', deadline: '', priority: 'MEDIUM', subject: '' })
  const [saving, setSaving] = useState(false)

  const fetchTasks = async (withLoading = true) => {
    try {
      if (withLoading) setLoading(true)
      const params = new URLSearchParams()
      if (keyword.trim()) params.set('q', keyword.trim())
      const { data } = await axios.get(`/api/tasks?${params}`)
      const qLower = keyword.trim().toLowerCase()
      const filtered = qLower
        ? (data as Task[]).filter((task) =>
            [task.title, task.description ?? '', task.subject ?? '']
              .join(' ')
              .toLowerCase()
              .includes(qLower)
          )
        : data
      setTasks(filtered)
    } catch {
      setTasks([])
    } finally {
      if (withLoading) setLoading(false)
    }
  }

  const timelineStatus = (task: Task): 'Forthcoming' | 'Pastdue' | 'Completed' => {
    if (task.status === 'DONE') return 'Completed'
    if (!task.deadline) return 'Forthcoming'
    const d = new Date(task.deadline)
    if (Number.isNaN(d.getTime())) return 'Forthcoming'
    return d.getTime() < Date.now() ? 'Pastdue' : 'Forthcoming'
  }

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setKeyword((prev) => (prev === q ? prev : q))
  }, [searchParams])

  useEffect(() => { fetchTasks(true) }, [keyword])

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
  const visibleTasks = useMemo(
    () =>
      sortTasksByDeadlineThenCreated(
        tasks.filter((task) => {
          const timeline = timelineStatus(task)
          if (viewFilter === 'completed') return timeline === 'Completed'
          if (viewFilter === 'overdue') return timeline === 'Pastdue'
          return timeline === 'Forthcoming'
        }),
      ),
    [tasks, viewFilter],
  )

  const taskGroups = groupVisibleTasks(visibleTasks, viewFilter, getJakartaYmd(new Date()))

  const filterCounts = {
    forthcoming: tasks.filter((t) => timelineStatus(t) === 'Forthcoming').length,
    overdue: tasks.filter((t) => timelineStatus(t) === 'Pastdue').length,
    completed: tasks.filter((t) => timelineStatus(t) === 'Completed').length,
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition">
          
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h5 className="fw-bold mb-0">Manajemen Tugas</h5>
              <p className="text-muted small mb-0">{visibleTasks.length} dari {tasks.length} tugas</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <i className="bi bi-plus-circle me-2"></i>Tambah Tugas
            </button>
          </div>

          
          <div className="card mb-4">
            <div className="card-body py-3">
              <div className="task-filter-wrap">
                <div className="task-filter-title">Filter</div>
                <div className="task-filter-group" role="tablist" aria-label="Filter tugas">
                <button
                  className={`task-filter-chip ${viewFilter === 'forthcoming' ? 'active' : ''}`}
                  onClick={() => setViewFilter('forthcoming')}
                >
                  <span>Forthcoming</span>
                  <b>{filterCounts.forthcoming}</b>
                </button>
                <button
                  className={`task-filter-chip overdue ${viewFilter === 'overdue' ? 'active' : ''}`}
                  onClick={() => setViewFilter('overdue')}
                >
                  <span>Overdue</span>
                  <b>{filterCounts.overdue}</b>
                </button>
                <button
                  className={`task-filter-chip completed ${viewFilter === 'completed' ? 'active' : ''}`}
                  onClick={() => setViewFilter('completed')}
                >
                  <span>Completed</span>
                  <b>{filterCounts.completed}</b>
                </button>
                </div>
              </div>
            </div>
          </div>

          
          {loading ? (
            <div className="task-loading-shell">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="task-skeleton-card">
                  <div className="task-skeleton-line w-50"></div>
                  <div className="task-skeleton-line w-75"></div>
                  <div className="task-skeleton-line w-25"></div>
                </div>
              ))}
              <p className="text-muted small mt-2 mb-0">Memuat tugas...</p>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox" style={{ fontSize: 48 }}></i>
              <p className="mt-3 mb-2 fw-semibold">Tidak ada tugas untuk filter ini</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                Tambah Tugas Pertama
              </button>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4 task-groups-root">
              {taskGroups.map((group) => (
                <section key={group.key} className="task-group" aria-labelledby={`task-group-${group.key}`}>
                  <div
                    id={`task-group-${group.key}`}
                    className="task-group-header d-flex align-items-center justify-content-between gap-2 flex-wrap"
                  >
                    <span className="task-group-title">{group.label}</span>
                    <span className="task-group-count">{group.tasks.length}</span>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {group.tasks.map((task) => (
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
                              {timelineStatus(task) === 'Pastdue' && (
                                <span className="badge rounded-pill px-2 bg-danger bg-opacity-10 text-danger" style={{ fontSize: 11 }}>
                                  Overdue
                                </span>
                              )}
                              {task.subject && (
                                <span className="badge task-subject-badge" style={{ fontSize: 11 }}>
                                  {task.subject}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-muted mb-0 mt-1 text-truncate" style={{ fontSize: 13 }}>
                                {task.description}
                              </p>
                            )}
                            {task.deadline && (() => {
                              const rem = formatRemainingBeforeDeadline(task.deadline, task.status)
                              return (
                              <div className="mt-1" style={{ fontSize: 12 }}>
                                <span className="text-muted">
                                  <i className="bi bi-calendar2 me-1"></i>
                                  {new Date(task.deadline).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                                {rem && (
                                  <span className="ms-2" style={{ color: 'var(--sh-text, #1e293b)', fontWeight: 600 }}>
                                    · {rem}
                                  </span>
                                )}
                              </div>
                              )
                            })()}
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            <select
                              className="form-select form-select-sm"
                              style={{ width: 'auto', fontSize: 12 }}
                              value={task.status}
                              onChange={(e) => handleStatus(task.id, e.target.value)}>
                              <option value="TODO">{statusLabel.TODO}</option>
                              <option value="IN_PROGRESS">{statusLabel.IN_PROGRESS}</option>
                              <option value="DONE">{statusLabel.DONE}</option>
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
                </section>
              ))}
            </div>
          )}

          
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
      <style jsx>{`
        .task-groups-root {
          margin-top: 2px;
        }
        .task-group-header {
          padding-bottom: 6px;
          border-bottom: 1px solid var(--sh-border);
        }
        .task-group-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--sh-text);
          letter-spacing: 0.02em;
        }
        .task-group-count {
          font-size: 11px;
          font-weight: 700;
          color: var(--sh-muted);
          background: color-mix(in srgb, var(--sh-card-bg) 78%, #64748b 22%);
          border-radius: 999px;
          padding: 3px 9px;
          line-height: 1.2;
        }
        .task-filter-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .task-filter-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--sh-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .task-filter-group {
          display: inline-grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          width: min(760px, 100%);
        }
        .task-filter-chip {
          border: 1px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          border-radius: 999px;
          min-height: 34px;
          padding: 6px 11px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.18s ease;
          justify-content: space-between;
          width: 100%;
        }
        .task-filter-chip b {
          border-radius: 999px;
          background: color-mix(in srgb, var(--sh-card-bg) 78%, #64748b 22%);
          color: var(--sh-text);
          font-size: 11px;
          line-height: 1;
          padding: 3px 7px;
        }
        .task-filter-chip.active {
          border-color: #6366f1;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(79, 70, 229, 0.22);
        }
        .task-filter-chip.overdue.active {
          border-color: #ef4444;
          background: linear-gradient(135deg, #dc2626, #ef4444);
          box-shadow: 0 8px 18px rgba(220, 38, 38, 0.22);
        }
        .task-filter-chip.completed.active {
          border-color: #10b981;
          background: linear-gradient(135deg, #059669, #10b981);
          box-shadow: 0 8px 18px rgba(5, 150, 105, 0.22);
        }
        .task-filter-chip.active b {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }
        .task-subject-badge {
          background: color-mix(in srgb, var(--sh-card-bg) 82%, #94a3b8 18%);
          color: var(--sh-muted);
          border: 1px solid var(--sh-border);
        }
        :global(.text-muted) {
          color: var(--sh-muted) !important;
        }
        :global(.card .fw-semibold),
        :global(.card .form-label),
        :global(.card .modal-title) {
          color: var(--sh-text);
        }
        .task-loading-shell {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .task-skeleton-card {
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          background: var(--sh-card-bg);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .task-skeleton-line {
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(148,163,184,0.15), rgba(148,163,184,0.35), rgba(148,163,184,0.15));
          background-size: 220% 100%;
          animation: skeletonShimmer 1.2s ease-in-out infinite;
        }
        :global(.task-filter-group .task-filter-chip) {
          background-color: var(--sh-card-bg);
        }
        :global(.card .form-select.form-select-sm) {
          background-color: color-mix(in srgb, var(--sh-card-bg) 92%, #64748b 8%) !important;
          color: var(--sh-text) !important;
          border-color: var(--sh-border) !important;
        }
        :global(.modal-content) {
          background: var(--sh-card-bg) !important;
          color: var(--sh-text) !important;
        }
        :global(.modal-header),
        :global(.modal-footer) {
          border-color: var(--sh-border) !important;
        }
        :global(:root[data-theme='dark'] .card .text-muted) {
          color: #a5b4c7 !important;
        }
        :global(:root[data-theme='dark'] .task-filter-title) {
          color: #b6c2d1 !important;
        }
        @media (max-width: 768px) {
          .task-filter-wrap {
            align-items: stretch;
          }
          .task-filter-title {
            width: 100%;
          }
          .task-filter-group {
            width: 100%;
            gap: 6px;
          }
          .task-filter-chip {
            min-height: 36px;
            padding: 6px 8px;
            font-size: 11px;
          }
          .task-filter-chip b {
            padding: 3px 6px;
            font-size: 10px;
          }
        }
        @keyframes skeletonShimmer {
          from { background-position: 200% 0; }
          to { background-position: -20% 0; }
        }
      `}</style>
    </div>
  )
}
