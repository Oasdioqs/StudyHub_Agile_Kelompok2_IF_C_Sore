'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type ClassDetail = {
  id: string
  name: string
  description: string | null
  inviteCode: string
  subject: string | null
  myRole: 'ADMIN' | 'MEMBER'
  members: Array<{ id: string, name: string, email: string, image: string | null, role: string, joinedAt: string }>
  tasks: Array<{ id: string, title: string, deadline: string | null, priority: string, description: string | null }>
  schedule: Array<{ id: string, dayOfWeek: number, title: string, startTime: string | null, endTime: string | null, place: string | null }>
}

export default function ClassDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'schedule' | 'members'>('tasks')

  // Forms
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annMsg, setAnnMsg] = useState('')
  const [sendingAnn, setSendingAnn] = useState(false)

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskPriority, setTaskPriority] = useState('MEDIUM')

  useEffect(() => {
    fetchClassData()
  }, [id])

  const fetchClassData = async () => {
    try {
      const res = await fetch(`/api/kelas/${id}`)
      if (!res.ok) throw new Error('Not found')
      setData(await res.json())
    } catch {
      router.replace('/kelas')
    } finally {
      setLoading(false)
    }
  }

  const handleSendAnnounce = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingAnn(true)
    await fetch(`/api/kelas/${id}/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: annTitle, message: annMsg })
    })
    setSendingAnn(false)
    setShowAnnounce(false)
    setAnnTitle('')
    setAnnMsg('')
    alert('Pengumuman terkirim ke member!')
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = taskId ? `/api/kelas/${id}/tasks/${taskId}` : `/api/kelas/${id}/tasks`
    const method = taskId ? 'PATCH' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle, description: taskDesc, deadline: taskDeadline || null, priority: taskPriority
      })
    })
    setShowTaskModal(false)
    fetchClassData()
  }

  const handleDeleteTask = async (tId: string) => {
    if (!confirm('Hapus tugas ini?')) return
    await fetch(`/api/kelas/${id}/tasks/${tId}`, { method: 'DELETE' })
    fetchClassData()
  }

  const handleLeaveClass = async () => {
    if (!confirm(data?.myRole === 'ADMIN' ? 'Kamu Komisaris! Menghapus kelas akan menghapus semua data kelas bagi semua member. Lanjut?' : 'Yakin ingin keluar?')) return
    await fetch(`/api/kelas/${id}`, { method: 'DELETE' })
    router.replace('/kelas')
  }

  if (loading || !data) {
    return (
      <div className="text-center py-5 text-muted">
        <div className="spinner-border spinner-border-sm mb-2" role="status"></div>
        <div>Memuat data kelas...</div>
      </div>
    )
  }

  return (
    <div className="class-detail pb-5">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <Link href="/kelas" className="btn btn-link px-0 text-decoration-none text-muted small"><i className="bi bi-arrow-left me-1"></i>Kembali</Link>
          <h3 className="fw-bold mb-1 mt-2">{data.name}</h3>
          <p className="text-muted small mb-2">{data.description || 'Tidak ada deskripsi'}</p>
          <div className="d-flex gap-2">
            <span className="badge bg-light text-dark border"><i className="bi bi-key me-1"></i>Kode: {data.inviteCode}</span>
            <span className={`badge ${data.myRole === 'ADMIN' ? 'bg-primary' : 'bg-secondary'}`}>
              {data.myRole === 'ADMIN' ? 'Komisaris' : 'Anggota'}
            </span>
          </div>
        </div>
        <div className="d-flex flex-column gap-2 text-end">
          {data.myRole === 'ADMIN' && (
            <button className="btn btn-outline-primary btn-sm rounded-pill px-3" onClick={() => setShowAnnounce(true)}>
              <i className="bi bi-megaphone me-1"></i>Broadcast
            </button>
          )}
          <button className="btn btn-outline-danger btn-sm rounded-pill px-3" onClick={handleLeaveClass}>
            <i className={`bi ${data.myRole === 'ADMIN' ? 'bi-trash' : 'bi-box-arrow-right'} me-1`}></i>
            {data.myRole === 'ADMIN' ? 'Hapus Kelas' : 'Keluar'}
          </button>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'tasks' ? 'active fw-bold' : 'text-muted'}`} onClick={() => setActiveTab('tasks')}>
            <i className="bi bi-list-task me-1"></i>Tugas ({data.tasks.length})
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'schedule' ? 'active fw-bold' : 'text-muted'}`} onClick={() => setActiveTab('schedule')}>
            <i className="bi bi-calendar3 me-1"></i>Jadwal
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'members' ? 'active fw-bold' : 'text-muted'}`} onClick={() => setActiveTab('members')}>
            <i className="bi bi-people me-1"></i>Anggota ({data.members.length})
          </button>
        </li>
      </ul>

      {activeTab === 'tasks' && (
        <div>
          {data.myRole === 'ADMIN' && (
            <div className="mb-3 text-end">
              <button className="btn btn-primary btn-sm rounded-pill px-3" onClick={() => { setTaskId(''); setTaskTitle(''); setTaskDesc(''); setTaskDeadline(''); setTaskPriority('MEDIUM'); setShowTaskModal(true); }}>
                <i className="bi bi-plus-lg me-1"></i>Tambah Tugas
              </button>
            </div>
          )}
          {data.tasks.length === 0 ? <p className="text-muted text-center py-4">Belum ada tugas kelas.</p> : (
            <div className="list-group">
              {data.tasks.map(t => (
                <div key={t.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-start p-3 rounded-3 mb-2 border">
                  <div>
                    <h6 className="mb-1 fw-bold">{t.title}</h6>
                    <p className="mb-1 small text-muted">{t.description}</p>
                    <div className="small text-muted d-flex gap-2 mt-2">
                      <span className="badge bg-light text-dark"><i className="bi bi-calendar-event me-1"></i>{t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID') : 'Tidak ada deadline'}</span>
                      <span className={`badge ${t.priority === 'HIGH' ? 'bg-danger' : t.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-success'}`}>Prioritas: {t.priority}</span>
                    </div>
                  </div>
                  {data.myRole === 'ADMIN' && (
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-light text-primary py-0 px-2" onClick={() => { setTaskId(t.id); setTaskTitle(t.title); setTaskDesc(t.description || ''); setTaskDeadline(t.deadline ? t.deadline.slice(0, 16) : ''); setTaskPriority(t.priority); setShowTaskModal(true); }}>Edit</button>
                      <button className="btn btn-sm btn-light text-danger py-0 px-2" onClick={() => handleDeleteTask(t.id)}>Hapus</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          {data.myRole === 'ADMIN' && (
            <div className="alert alert-info py-2 px-3 small border-0 bg-opacity-10 text-primary d-flex justify-content-between align-items-center">
              <span>Untuk mengubah jadwal mingguan kelas, <Link href="/calendar">buka halaman Kalender</Link> dan klik &quot;Tambah Jadwal&quot;. Sinkronisasi jadwal kelas sudah tertanam disana.</span>
            </div>
          )}
          {data.schedule.length === 0 ? <p className="text-muted text-center py-4">Belum ada jadwal mingguan.</p> : (
            <div className="row g-2">
              {data.schedule.map(s => {
                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
                return (
                  <div key={s.id} className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm mb-2">
                      <div className="card-body py-2 px-3 d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-bold small">{days[s.dayOfWeek]}</div>
                          <div className="text-dark fw-semibold">{s.title}</div>
                        </div>
                        <div className="text-end small text-muted">
                          <div>{s.startTime} - {s.endTime}</div>
                          <div>{s.place}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="list-group list-group-flush border rounded-3 overflow-hidden">
          {data.members.map(m => (
            <div key={m.id} className="list-group-item d-flex align-items-center p-3">
              <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-3" style={{ width: 40, height: 40, fontSize: '1rem', fontWeight: 'bold', backgroundImage: m.image ? `url(${m.image})` : 'none', backgroundSize: 'cover' }}>
                {!m.image && m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold">{m.name} {m.id === data.id && '(Kamu)'}</div>
                <div className="small text-muted">{m.email}</div>
              </div>
              <span className={`badge ${m.role === 'ADMIN' ? 'bg-primary' : 'bg-light text-muted border'} rounded-pill px-3`}>
                {m.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Task form modal */}
      {showTaskModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">{taskId ? 'Edit Tugas Kelas' : 'Tambah Tugas Kelas'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowTaskModal(false)}></button>
              </div>
              <form onSubmit={handleSaveTask}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Judul Tugas</label>
                    <input type="text" className="form-control form-control-sm" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Deskripsi</label>
                    <textarea className="form-control form-control-sm" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} rows={3}></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Deadline</label>
                      <input type="datetime-local" className="form-control form-control-sm" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Prioritas</label>
                      <select className="form-select form-select-sm" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                        <option value="LOW">Rendah (Low)</option>
                        <option value="MEDIUM">Sedang (Med)</option>
                        <option value="HIGH">Tinggi (High)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light btn-sm px-3 rounded-pill" onClick={() => setShowTaskModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 rounded-pill">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Announce Modal */}
      {showAnnounce && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">Kirim Pengumuman Broadcast</h5>
                <button type="button" className="btn-close" onClick={() => setShowAnnounce(false)}></button>
              </div>
              <form onSubmit={handleSendAnnounce}>
                <div className="modal-body">
                  <div className="alert alert-info p-2 small"><i className="bi bi-info-circle me-1"></i>Pesan ini akan dikirim sebagai lonceng Notifikasi ke seluruh anggota kelas secara instan.</div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Ringkasan Info / Judul</label>
                    <input type="text" className="form-control form-control-sm" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Misal: Info Kuliah Kosong" required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Pesan Lengkap</label>
                    <textarea className="form-control form-control-sm" value={annMsg} onChange={e => setAnnMsg(e.target.value)} rows={4} required placeholder="Detail pengumuman rincian jadwal atau tugas mendadak..."></textarea>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light btn-sm px-3 rounded-pill" onClick={() => setShowAnnounce(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 rounded-pill" disabled={sendingAnn}><i className="bi bi-send-fill me-1"></i>Kirim Notif</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
