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
      <div className="d-flex justify-content-between align-items-start mb-4 p-4 rounded-4 shadow-sm border" style={{ background: 'var(--sh-card-bg)', borderColor: 'var(--sh-border)' }}>
        <div>
          <Link href="/kelas" className="btn btn-link px-0 text-decoration-none text-secondary small fw-medium mb-2 d-inline-block"><i className="bi bi-arrow-left me-1"></i>Kembali ke Daftar</Link>
          <h3 className="fw-bold mb-1 mt-1" style={{ letterSpacing: '-0.5px', color: 'var(--sh-text)' }}>{data.name}</h3>
          <p className="text-secondary small fw-medium mb-3">{data.description || 'Tidak ada deskripsi'}</p>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-semibold"><i className="bi bi-key-fill text-warning me-2"></i>Kode: <span className="user-select-all font-monospace">{data.inviteCode}</span></span>
            <span className={`badge ${data.myRole === 'ADMIN' ? 'bg-primary' : 'bg-secondary'} px-3 py-2 rounded-pill fw-bold`}>
              <i className={`bi ${data.myRole === 'ADMIN' ? 'bi-shield-check' : 'bi-person'} me-1`}></i>
              {data.myRole === 'ADMIN' ? 'Komisaris' : 'Anggota'}
            </span>
          </div>
        </div>
        <div className="d-flex flex-column gap-2 text-end mt-4 mt-md-0">
          {data.myRole === 'ADMIN' && (
            <button className="btn btn-primary btn-sm rounded-pill px-4 fw-bold shadow-sm" onClick={() => setShowAnnounce(true)}>
              <i className="bi bi-megaphone-fill me-2"></i>Broadcast Info
            </button>
          )}
          <button className="btn btn-outline-danger btn-sm rounded-pill px-4 fw-bold" onClick={handleLeaveClass}>
            <i className={`bi ${data.myRole === 'ADMIN' ? 'bi-trash-fill' : 'bi-box-arrow-right'} me-2`}></i>
            {data.myRole === 'ADMIN' ? 'Hapus Kelas' : 'Keluar Kelas'}
          </button>
        </div>
      </div>

      <ul className="nav nav-pills mb-4 gap-2 border-bottom pb-3">
        <li className="nav-item">
          <button className={`nav-link rounded-pill px-4 fw-bold ${activeTab === 'tasks' ? 'active shadow-sm' : 'text-secondary bg-light'}`} onClick={() => setActiveTab('tasks')}>
            <i className="bi bi-list-task me-2"></i>Tugas <span className="badge bg-white text-primary ms-1 rounded-pill">{data.tasks.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link rounded-pill px-4 fw-bold ${activeTab === 'schedule' ? 'active shadow-sm' : 'text-secondary bg-light'}`} onClick={() => setActiveTab('schedule')}>
            <i className="bi bi-calendar3 me-2"></i>Jadwal
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link rounded-pill px-4 fw-bold ${activeTab === 'members' ? 'active shadow-sm' : 'text-secondary bg-light'}`} onClick={() => setActiveTab('members')}>
            <i className="bi bi-people-fill me-2"></i>Anggota <span className="badge bg-white text-primary ms-1 rounded-pill">{data.members.length}</span>
          </button>
        </li>
      </ul>

      {activeTab === 'tasks' && (
        <div className="animation-fade-in">
          {data.myRole === 'ADMIN' && (
            <div className="mb-3 d-flex justify-content-end">
              <button className="btn btn-primary btn-sm rounded-pill px-4 fw-bold shadow-sm" onClick={() => { setTaskId(''); setTaskTitle(''); setTaskDesc(''); setTaskDeadline(''); setTaskPriority('MEDIUM'); setShowTaskModal(true); }}>
                <i className="bi bi-plus-lg me-2"></i>Tambah Tugas Kelas
              </button>
            </div>
          )}
          {data.tasks.length === 0 ? <div className="text-secondary text-center py-5 bg-light rounded-4 border-dashed mt-3"><i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>Belum ada tugas kelas.</div> : (
            <div className="list-group gap-2">
              {data.tasks.map(t => (
                <div key={t.id} className="list-group-item d-flex justify-content-between align-items-start p-4 rounded-4 border-0 shadow-sm" style={{ background: 'var(--sh-card-bg)' }}>
                  <div>
                    <h6 className="mb-1 fw-bold fs-5" style={{ color: 'var(--sh-text)' }}>{t.title}</h6>
                    <p className="mb-2 small text-secondary fw-medium lh-lg">{t.description}</p>
                    <div className="small d-flex flex-wrap gap-2 mt-3">
                      <span className="badge bg-light text-dark border px-3 py-2 rounded-pill"><i className="bi bi-calendar-event text-primary me-2"></i>{t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Tidak ada batas waktu'}</span>
                      <span className={`badge px-3 py-2 rounded-pill ${t.priority === 'HIGH' ? 'bg-danger text-white' : t.priority === 'MEDIUM' ? 'bg-warning text-dark' : 'bg-success text-white'}`}><i className="bi bi-flag-fill me-1"></i> Prio: {t.priority}</span>
                    </div>
                  </div>
                  {data.myRole === 'ADMIN' && (
                    <div className="d-flex flex-column gap-2 ms-3">
                      <button className="btn btn-sm btn-light text-primary py-1 px-3 fw-bold rounded-pill" onClick={() => { setTaskId(t.id); setTaskTitle(t.title); setTaskDesc(t.description || ''); setTaskDeadline(t.deadline ? t.deadline.slice(0, 16) : ''); setTaskPriority(t.priority); setShowTaskModal(true); }}>Edit</button>
                      <button className="btn btn-sm btn-light text-danger py-1 px-3 fw-bold rounded-pill" onClick={() => handleDeleteTask(t.id)}>Hapus</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="animation-fade-in">
          {data.myRole === 'ADMIN' && (
            <div className="alert alert-primary py-3 px-4 rounded-4 shadow-sm border-0 d-flex gap-3 align-items-center mb-4">
              <i className="bi bi-info-circle-fill fs-3 text-primary"></i>
              <div>
                <strong>Pengaturan Jadwal Sinkronisasi Mingguan</strong><br/>
                <span className="small">Untuk menambah, menghapus, atau mengubah hari jadwal kelas ini, silakan ke <Link href="/calendar" className="fw-bold text-decoration-none">halaman Kalender</Link> dan klik tombol "Tambah Jadwal".</span>
              </div>
            </div>
          )}
          {data.schedule.length === 0 ? <div className="text-secondary text-center py-5 bg-light rounded-4 border-dashed mt-3"><i className="bi bi-calendar-x fs-1 d-block mb-2 opacity-50"></i>Belum ada jadwal mingguan kelas.</div> : (
            <div className="row g-3">
              {data.schedule.map(s => {
                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
                return (
                  <div key={s.id} className="col-12 col-md-6 col-lg-4">
                    <div className="card border-0 shadow-sm h-100 rounded-4" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.02) 100%)' }}>
                      <div className="card-body p-4 d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="badge bg-primary rounded-pill px-3 py-2 fw-bold"><i className="bi bi-calendar-day-fill me-2"></i>{days[s.dayOfWeek]}</span>
                        </div>
                        <h5 className="fw-bold mb-3" style={{ color: 'var(--sh-text)' }}>{s.title}</h5>
                        <div className="mt-auto small text-secondary fw-semibold p-3 rounded-3 shadow-sm" style={{ backgroundColor: 'var(--sh-bg)' }}>
                          <div className="d-flex align-items-center gap-2 mb-2"><i className="bi bi-clock-history text-warning fs-6"></i> {s.startTime} - {s.endTime}</div>
                          <div className="d-flex align-items-center gap-2 m-0"><i className="bi bi-geo-alt-fill text-danger fs-6"></i> {s.place || 'Ruangan belum diatur'}</div>
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
        <div className="list-group gap-2 animation-fade-in">
          {data.members.map(m => (
            <div key={m.id} className="list-group-item d-flex align-items-center p-3 rounded-4 shadow-sm border-0" style={{ background: 'var(--sh-card-bg)' }}>
              <div className="rounded-circle bg-primary bg-gradient text-white d-flex align-items-center justify-content-center me-3 shadow-sm border" style={{ width: 48, height: 48, fontSize: '1.2rem', fontWeight: 'bold', backgroundImage: m.image ? `url(${m.image})` : 'none', backgroundSize: 'cover' }}>
                {!m.image && m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold fs-6" style={{ color: 'var(--sh-text)' }}>{m.name} {m.id === data.id && <span className="text-primary ms-1">(Kamu)</span>}</div>
                <div className="small text-secondary fw-medium">{m.email}</div>
              </div>
              <span className={`badge ${m.role === 'ADMIN' ? 'bg-primary' : 'bg-light text-secondary border'} rounded-pill px-4 py-2 mt-2 mt-sm-0`}>
                <i className={`bi ${m.role === 'ADMIN' ? 'bi-star-fill text-warning' : 'bi-person-fill'} me-2`}></i>
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
