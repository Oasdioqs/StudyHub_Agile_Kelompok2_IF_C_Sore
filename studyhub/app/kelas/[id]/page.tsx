'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type SyncMode = 'MAYA' | 'LANGSUNG'

type ScheduleSlot = {
  id: string
  dayOfWeek: number
  title: string
  startTime: string | null
  endTime: string | null
  place: string | null
  syncMode?: SyncMode
}

// Monday-first convention (0=Senin) — matches calendar mondayFirstIndex
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAY_COLORS = ['#4f46e5', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#f97316']

type ClassDetail = {
  id: string
  name: string
  description: string | null
  inviteCode: string
  subject: string | null
  myRole: 'ADMIN' | 'MEMBER'
  members: Array<{ id: string; name: string; email: string; image: string | null; role: string; joinedAt: string }>
  tasks: Array<{ id: string; title: string; deadline: string | null; priority: string; description: string | null }>
  schedule: ScheduleSlot[]
}



export default function ClassDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'announcements' | 'schedule' | 'members'>('tasks')
  // Announcements
  const [announcements, setAnnouncements] = useState<Array<{
    id: string; title: string; message: string; createdAt: string;
    createdBy: { id: string; name: string; image: string | null }
  }>>([]) 
  const [loadingAnn, setLoadingAnn] = useState(false)
  // Separate schedule state with syncMode (fetched from /schedule endpoint)
  const [liveSchedule, setLiveSchedule] = useState<ScheduleSlot[]>([])
  const [loadingMode, setLoadingMode] = useState(false)

  // Live meeting URL per slot
  const [liveMeetingUrls, setLiveMeetingUrls] = useState<Record<string, string>>({})
  const [savingLiveUrl, setSavingLiveUrl] = useState<string | null>(null)

  // Forms
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annMsg, setAnnMsg] = useState('')
  const [sendingAnn, setSendingAnn] = useState(false)
  const [annSuccess, setAnnSuccess] = useState(false)

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [taskPriority, setTaskPriority] = useState('MEDIUM')
  const [savingTask, setSavingTask] = useState(false)

  // Schedule management
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleSlots, setScheduleSlots] = useState<{ dayOfWeek: number; title: string; startTime: string; endTime: string; place: string }[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [updatingMode, setUpdatingMode] = useState<string | null>(null)

  // Group settings
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsSubject, setSettingsSubject] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // Class notification settings (admin)
  const [classTaskReminders, setClassTaskReminders] = useState<number[]>([120, 60])
  const [classScheduleReminders, setClassScheduleReminders] = useState<number[]>([120, 60])
  const [savingClassNotif, setSavingClassNotif] = useState(false)
  const [classNotifSuccess, setClassNotifSuccess] = useState(false)

  // Invite code visibility
  const [showInviteCode, setShowInviteCode] = useState(false)

  // Kick member
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null)

  useEffect(() => {
    fetchClassData()
  }, [id])

  const fetchClassData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kelas/${id}`)
      const d = await res.json()
      if (res.ok) {
        setData(d)
        setLiveSchedule([]) // reset, next fetch from schedule endpoint
      }
      // Also fetch schedule with syncMode separately
      void fetchScheduleWithMode()
    } catch {
      router.replace('/kelas')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduleWithMode = async () => {
    try {
      const res = await fetch(`/api/kelas/${id}/schedule`)
      if (!res.ok) return
      const slots = await res.json()
      if (Array.isArray(slots)) {
        setLiveSchedule(slots)
        // Populate live meeting URLs from note field
        const urlMap: Record<string, string> = {}
        for (const s of slots) {
          if (s.liveMeetingUrl) urlMap[s.id] = s.liveMeetingUrl
        }
        setLiveMeetingUrls(urlMap)
      }
    } catch { /* ignore */ }
  }

  const fetchAnnouncements = async () => {
    setLoadingAnn(true)
    try {
      const res = await fetch(`/api/kelas/${id}/announcements`)
      if (res.ok) setAnnouncements(await res.json())
    } finally {
      setLoadingAnn(false)
    }
  }

  const handleSendAnnounce = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingAnn(true)
    try {
      const res = await fetch(`/api/kelas/${id}/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: annTitle, message: annMsg }),
      })
      if (res.ok) {
        setAnnSuccess(true)
        setTimeout(() => {
          setShowAnnounce(false)
          setAnnTitle('')
          setAnnMsg('')
          setAnnSuccess(false)
          fetchAnnouncements() // refresh tab pengumuman
        }, 1800)
      } else {
        const d = await res.json().catch(() => null)
        alert(d?.error || 'Gagal mengirim broadcast.')
      }
    } catch {
      alert('Gagal mengirim. Coba lagi.')
    } finally {
      setSendingAnn(false)
    }
  }

  const openSettingsModal = () => {
    if (!data) return
    setSettingsName(data.name)
    setSettingsDesc(data.description ?? '')
    setSettingsSubject(data.subject ?? '')
    setSettingsError('')
    // Fetch class notif settings
    fetch(`/api/kelas/${id}/notification-settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.taskReminders) setClassTaskReminders(d.taskReminders)
        if (d.scheduleReminders) setClassScheduleReminders(d.scheduleReminders)
      }).catch(() => {})
    setShowSettingsModal(true)
  }

  const handleSaveClassNotif = async () => {
    setSavingClassNotif(true)
    try {
      await fetch(`/api/kelas/${id}/notification-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskReminders: classTaskReminders, scheduleReminders: classScheduleReminders }),
      })
      setClassNotifSuccess(true)
      setTimeout(() => setClassNotifSuccess(false), 2500)
    } finally {
      setSavingClassNotif(false)
    }
  }

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Keluarkan "${memberName}" dari kelas ini?`)) return
    setKickingMemberId(memberId)
    try {
      const res = await fetch(`/api/kelas/${id}/members/${memberId}`, { method: 'DELETE' })
      if (res.ok) fetchClassData()
      else {
        const d = await res.json().catch(() => null)
        alert(d?.error || 'Gagal mengeluarkan anggota.')
      }
    } finally {
      setKickingMemberId(null)
    }
  }

  const handleSaveSettings = async () => {
    if (!settingsName.trim()) { setSettingsError('Nama kelas wajib diisi.'); return }
    setSavingSettings(true)
    setSettingsError('')
    try {
      const res = await fetch(`/api/kelas/${id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: settingsName.trim(), description: settingsDesc.trim() || null, subject: settingsSubject.trim() || null }),
      })
      if (res.ok) {
        setShowSettingsModal(false)
        fetchClassData()
      } else {
        const d = await res.json().catch(() => null)
        setSettingsError(d?.error || 'Gagal menyimpan pengaturan.')
      }
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTask(true)
    const url = taskId ? `/api/kelas/${id}/tasks/${taskId}` : `/api/kelas/${id}/tasks`
    const method = taskId ? 'PATCH' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: taskTitle, description: taskDesc, deadline: taskDeadline || null, priority: taskPriority }),
    })
    setSavingTask(false)
    setShowTaskModal(false)
    fetchClassData()
  }

  const handleDeleteTask = async (tId: string) => {
    if (!confirm('Hapus tugas ini?')) return
    await fetch(`/api/kelas/${id}/tasks/${tId}`, { method: 'DELETE' })
    fetchClassData()
  }

  const handleLeaveClass = async () => {
    if (!confirm(data?.myRole === 'ADMIN'
      ? 'Kamu Komisaris! Menghapus kelas akan menghapus semua data kelas bagi semua member. Lanjut?'
      : 'Yakin ingin keluar dari kelas ini?')) return
    await fetch(`/api/kelas/${id}`, { method: 'DELETE' })
    router.replace('/kelas')
  }

  const openScheduleModal = () => {
    const current = (liveSchedule.length > 0 ? liveSchedule : data?.schedule || []).map((s) => ({
      dayOfWeek: s.dayOfWeek,
      title: s.title,
      startTime: s.startTime || '',
      endTime: s.endTime || '',
      place: s.place || '',
    }))
    // Default: Senin (index 0 in Monday-first)
    setScheduleSlots(current.length > 0 ? current : [{ dayOfWeek: 0, title: '', startTime: '', endTime: '', place: '' }])
    setShowScheduleModal(true)
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    const validSlots = scheduleSlots.filter((s) => s.title.trim())
    try {
      const res = await fetch(`/api/kelas/${id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: validSlots }),
      })
      if (res.ok) {
        const updated = await res.json()
        if (Array.isArray(updated)) setLiveSchedule(updated)
        setShowScheduleModal(false)
        fetchClassData()
      }
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleToggleMode = async (slotId: string | 'all', currentMode: SyncMode) => {
    setUpdatingMode(slotId)
    setLoadingMode(true)
    const newMode: SyncMode = currentMode === 'LANGSUNG' ? 'MAYA' : 'LANGSUNG'
    try {
      const res = await fetch(`/api/kelas/${id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncMode: newMode, ...(slotId !== 'all' ? { slotId } : {}) }),
      })
      if (res.ok) {
        // Update liveSchedule state directly from response (includes syncMode)
        const updated = await res.json()
        if (Array.isArray(updated)) {
          setLiveSchedule(updated)
          const urlMap: Record<string, string> = {}
          for (const s of updated) {
            if (s.liveMeetingUrl) urlMap[s.id] = s.liveMeetingUrl
          }
          setLiveMeetingUrls((prev) => ({ ...prev, ...urlMap }))
        } else {
          // Fallback: optimistic update
          setLiveSchedule((prev) =>
            prev.map((s) =>
              slotId === 'all' || s.id === slotId ? { ...s, syncMode: newMode } : s
            )
          )
        }
      }
    } catch (e) {
      console.error('Toggle mode error:', e)
    } finally {
      setUpdatingMode(null)
      setLoadingMode(false)
    }
  }

  const handleSaveLiveMeetingUrl = async (slotId: string) => {
    setSavingLiveUrl(slotId)
    try {
      const url = liveMeetingUrls[slotId] || ''
      const res = await fetch(`/api/kelas/${id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, liveMeetingUrl: url }),
      })
      if (res.ok) {
        const updated = await res.json()
        if (Array.isArray(updated)) setLiveSchedule(updated)
      }
    } catch (e) {
      console.error('Save live URL error:', e)
    } finally {
      setSavingLiveUrl(null)
    }
  }

  if (loading || !data) {
    return (
      <div className="cd-skeleton-wrap">
        {/* Header skeleton */}
        <div className="cd-skeleton-header">
          <div className="cd-sk" style={{ width: 36, height: 36, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="cd-sk" style={{ height: 22, width: '55%', marginBottom: 10, borderRadius: 8 }} />
            <div className="cd-sk" style={{ height: 14, width: '35%', borderRadius: 8 }} />
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="cd-sk" style={{ height: 44, borderRadius: 14, marginBottom: 16 }} />
        {/* Cards skeleton */}
        <div className="cd-sk" style={{ height: 100, borderRadius: 16, marginBottom: 12 }} />
        <div className="cd-sk" style={{ height: 100, borderRadius: 16, marginBottom: 12 }} />
        <div className="cd-sk" style={{ height: 100, borderRadius: 16, opacity: 0.6 }} />
      </div>
    )
  }

  const displaySchedule = liveSchedule.length > 0 ? liveSchedule : data.schedule
  const hasSchedule = displaySchedule.length > 0
  const currentWeekMode: SyncMode = displaySchedule.length > 0 ? (displaySchedule[0].syncMode || 'LANGSUNG') : 'LANGSUNG'

  return (
    <div className="cd-wrap">
      {/* ── Header ── */}
      <div className="cd-header">
        {/* Back button — baris sendiri di atas */}
        <div className="cd-header-top-row">
          <Link href="/kelas" className="cd-back-link" title="Kembali ke Daftar Kelas">
            <i className="bi bi-arrow-left" />
          </Link>
          <div className="cd-header-actions">
            {data.myRole === 'ADMIN' && (
              <>
                <button className="cd-btn-secondary" title="Pengaturan Kelas" onClick={openSettingsModal}>
                  <i className="bi bi-gear-fill" />
                  <span className="cd-btn-text">Pengaturan</span>
                </button>
                <button className="cd-btn-primary" onClick={() => setShowAnnounce(true)}>
                  <i className="bi bi-megaphone-fill" />
                  <span className="cd-btn-text">Broadcast</span>
                </button>
              </>
            )}
            <button className="cd-btn-danger" onClick={handleLeaveClass}>
              <i className={`bi ${data.myRole === 'ADMIN' ? 'bi-trash-fill' : 'bi-box-arrow-right'}`} />
              <span className="cd-btn-text">{data.myRole === 'ADMIN' ? 'Hapus Kelas' : 'Keluar'}</span>
            </button>
          </div>
        </div>
        {/* Avatar + info row */}
        <div className="cd-header-left">
          <div className="cd-header-avatar">
            {data.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="cd-title">{data.name}</h3>
            <p className="cd-subtitle">{data.description || 'Tidak ada deskripsi'}</p>
            <div className="cd-badges">
              <span className="cd-badge code" style={{ userSelect: showInviteCode ? 'all' : 'none' }}>
                <i className="bi bi-key-fill" />
                <span style={{ letterSpacing: showInviteCode ? '0.05em' : '0.15em' }}>
                  {showInviteCode ? data.inviteCode : '••••••••'}
                </span>
                <button
                  type="button"
                  className="cd-code-eye"
                  onClick={() => setShowInviteCode(v => !v)}
                  title={showInviteCode ? 'Sembunyikan kode' : 'Tampilkan kode'}
                >
                  <i className={`bi ${showInviteCode ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                </button>
              </span>
              <span className={`cd-badge role ${data.myRole === 'ADMIN' ? 'admin' : 'member'}`}>
                <i className={`bi ${data.myRole === 'ADMIN' ? 'bi-shield-check' : 'bi-person'}`} />
                {data.myRole === 'ADMIN' ? 'Komisaris' : 'Anggota'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="cd-tabs-wrap">
        <div className="cd-tabs">
          {(['announcements', 'tasks', 'schedule', 'members'] as const).map((tab) => (
            <button
              key={tab}
              className={`cd-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'announcements' && announcements.length === 0) fetchAnnouncements()
              }}
            >
              <i className={`bi ${
                tab === 'tasks' ? 'bi-list-task'
                : tab === 'announcements' ? 'bi-megaphone-fill'
                : tab === 'schedule' ? 'bi-calendar3'
                : 'bi-people-fill'
              }`} />
              {tab === 'tasks' ? 'Tugas' : tab === 'announcements' ? 'Pengumuman' : tab === 'schedule' ? 'Jadwal' : 'Anggota'}
              {tab === 'tasks' && <span className="cd-tab-badge">{data.tasks.length}</span>}
              {tab === 'members' && <span className="cd-tab-badge">{data.members.length}</span>}
              {tab === 'announcements' && announcements.length > 0 && <span className="cd-tab-badge">{announcements.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tasks ── */}
      {activeTab === 'tasks' && (
        <div className="cd-section">
          {data.myRole === 'ADMIN' && (
            <div className="cd-section-toolbar cd-section-toolbar-left">
              <button className="cd-btn-primary" onClick={() => {
                setTaskId(''); setTaskTitle(''); setTaskDesc('')
                setTaskDeadline(''); setTaskPriority('MEDIUM')
                setShowTaskModal(true)
              }}>
                <i className="bi bi-plus-lg" /> Tambah Tugas Kelas
              </button>
            </div>
          )}
          {data.tasks.length === 0 ? (
            <div className="cd-empty">
              <i className="bi bi-inbox" />
              <p>Belum ada tugas kelas.</p>
            </div>
          ) : (
            <div className="cd-task-list">
              {data.tasks.map((t, idx) => (
                <div key={t.id} className="cd-task-card" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="cd-task-body">
                    <div className={`cd-priority-dot ${t.priority.toLowerCase()}`} />
                    <div>
                      <h6 className="cd-task-title">{t.title}</h6>
                      {t.description && <p className="cd-task-desc">{t.description}</p>}
                      <div className="cd-task-meta">
                        <span className="cd-meta-badge">
                          <i className="bi bi-calendar-event" />
                          {t.deadline
                            ? new Date(t.deadline).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Tidak ada batas waktu'}
                        </span>
                        <span className={`cd-prio-badge ${t.priority.toLowerCase()}`}>
                          <i className="bi bi-flag-fill" /> {t.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  {data.myRole === 'ADMIN' && (
                    <div className="cd-task-actions">
                      <button className="cd-action-btn edit" onClick={() => {
                        setTaskId(t.id); setTaskTitle(t.title)
                        setTaskDesc(t.description || '')
                        setTaskDeadline(t.deadline ? t.deadline.slice(0, 16) : '')
                        setTaskPriority(t.priority)
                        setShowTaskModal(true)
                      }}>
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button className="cd-action-btn delete" onClick={() => handleDeleteTask(t.id)}>
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pengumuman ── */}
      {activeTab === 'announcements' && (
        <div className="cd-section">
          {loadingAnn ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="cd-sk" style={{ height: 90, borderRadius: 16, opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="cd-empty">
              <i className="bi bi-megaphone" />
              <p>Belum ada pengumuman kelas.</p>
              {data.myRole === 'ADMIN' && (
                <button className="cd-btn-primary" style={{ marginTop: 8 }} onClick={() => setShowAnnounce(true)}>
                  <i className="bi bi-megaphone-fill" /> Kirim Pengumuman
                </button>
              )}
            </div>
          ) : (
            <div className="cd-ann-feed">
              {announcements.map((ann, idx) => (
                <div key={ann.id} className="cd-ann-card" style={{ animationDelay: `${idx * 40}ms` }}>
                  <div className="cd-ann-avatar">
                    {ann.createdBy.image
                      ? <img src={ann.createdBy.image} alt={ann.createdBy.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : ann.createdBy.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="cd-ann-body">
                    <div className="cd-ann-meta cd-ann-meta-left">
                      <span className="cd-ann-sender">{ann.createdBy.name}</span>
                      <span className="cd-ann-time">
                        {new Date(ann.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="cd-ann-title">{ann.title}</div>
                    <p className="cd-ann-msg">{ann.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Schedule ── */}
      {activeTab === 'schedule' && (
        <div className="cd-section">
          {data.myRole === 'ADMIN' && (
            <div className="cd-schedule-toolbar">
              {hasSchedule ? (
                <div className="cd-schedule-info">
                  <div className="cd-schedule-info-icon">
                    <i className={`bi ${currentWeekMode === 'MAYA' ? 'bi-display' : 'bi-calendar-check-fill'}`} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <div className="cd-schedule-info-title">Jadwal Tetap Aktif</div>
                    <div className="cd-schedule-info-sub">Jadwal ini berlaku setiap minggu. Ubah jadwal atau atur mode pertemuan minggu ini.</div>
                  </div>
                  <div className="cd-schedule-info-actions">
                    <button className="cd-mode-all-btn" onClick={() => handleToggleMode('all', currentWeekMode)} disabled={updatingMode === 'all' || loadingMode}>
                      {updatingMode === 'all' ? <span className="cd-spin-sm" /> : <i className={`bi ${currentWeekMode === 'MAYA' ? 'bi-people-fill' : 'bi-display'}`} />}
                      Set Semua: {currentWeekMode === 'MAYA' ? '→ Langsung' : '→ Sinkron Maya'}
                    </button>
                    <button className="cd-edit-sched-btn" onClick={openScheduleModal}>
                      <i className="bi bi-pencil-square" /> Ubah Jadwal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cd-schedule-empty-admin">
                  <i className="bi bi-calendar-plus" />
                  <div>
                    <div className="cd-schedule-info-title">Belum ada jadwal</div>
                    <div className="cd-schedule-info-sub">Tambahkan jadwal kuliah untuk pertama kali — akan menjadi jadwal tetap kelas ini.</div>
                  </div>
                  <button className="cd-btn-primary" onClick={openScheduleModal}>
                    <i className="bi bi-plus-lg" /> Tambah Jadwal
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasSchedule ? (
            <div className="cd-empty">
              <i className="bi bi-calendar-x" />
              <p>Belum ada jadwal mingguan kelas.</p>
            </div>
          ) : (
            <div className="cd-schedule-grid">
              {displaySchedule.map((s, idx) => {
                const col = DAY_COLORS[s.dayOfWeek % 7] || '#4f46e5'
                const mode = s.syncMode || 'LANGSUNG'
                const slotLiveUrl = liveMeetingUrls[s.id] || ''
                return (
                  <div key={s.id} className="cd-slot-card" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div className="cd-slot-day" style={{ color: col, background: col + '18' }}>
                      <i className="bi bi-calendar-day-fill" /> {DAYS[s.dayOfWeek]}
                    </div>
                    <div className="cd-slot-mode-badge" style={{ background: mode === 'MAYA' ? '#eef2ff' : '#f0fdf4', color: mode === 'MAYA' ? '#4f46e5' : '#059669' }}>
                      <i className={`bi ${mode === 'MAYA' ? 'bi-display' : 'bi-people-fill'}`} />
                      {mode === 'MAYA' ? 'Sinkron Maya' : 'Langsung'}
                    </div>
                    <h5 className="cd-slot-title">{s.title}</h5>
                    <div className="cd-slot-meta">
                      <div><i className="bi bi-clock-history" /> {s.startTime} – {s.endTime || '?'}</div>
                      <div><i className="bi bi-geo-alt-fill" /> {s.place || 'Ruangan belum diatur'}</div>
                    </div>
                    {/* Live meeting link — tampil kalau mode MAYA */}
                    {mode === 'MAYA' && (
                      <div className="cd-live-meeting-box">
                        <div className="cd-live-meeting-label">
                          <i className="bi bi-camera-video-fill" /> Link Live Meeting
                          <span className="cd-live-optional">(opsional)</span>
                        </div>
                        {data.myRole === 'ADMIN' ? (
                          <div className="cd-live-input-row">
                            <input
                              type="url"
                              className="cd-live-input"
                              placeholder="https://meet.google.com/..."
                              value={slotLiveUrl}
                              onChange={(e) => setLiveMeetingUrls((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="cd-live-save-btn"
                              onClick={() => handleSaveLiveMeetingUrl(s.id)}
                              disabled={savingLiveUrl === s.id}
                            >
                              {savingLiveUrl === s.id ? <span className="cd-spin-sm" /> : <i className="bi bi-check-lg" />}
                            </button>
                          </div>
                        ) : slotLiveUrl ? (
                          <a href={slotLiveUrl} target="_blank" rel="noopener noreferrer" className="cd-live-link">
                            <i className="bi bi-box-arrow-up-right" /> Buka Live Meeting
                          </a>
                        ) : (
                          <span className="cd-live-empty">Link belum diatur komisaris</span>
                        )}
                      </div>
                    )}
                    {/* Tampilkan link untuk member jika non-MAYA tapi ada URL tersimpan */}
                    {mode !== 'MAYA' && slotLiveUrl && data.myRole !== 'ADMIN' && (
                      <a href={slotLiveUrl} target="_blank" rel="noopener noreferrer" className="cd-live-link">
                        <i className="bi bi-camera-video-fill" /> Live Meeting
                      </a>
                    )}
                    {data.myRole === 'ADMIN' && (
                      <button
                        className="cd-slot-toggle"
                        onClick={() => handleToggleMode(s.id, mode)}
                        disabled={updatingMode === s.id || loadingMode}
                      >
                        {updatingMode === s.id ? <span className="cd-spin-sm" /> : <i className={`bi ${mode === 'MAYA' ? 'bi-people-fill' : 'bi-display'}`} />}
                        Ubah ke {mode === 'MAYA' ? 'Langsung' : 'Sinkron Maya'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Members ── */}
      {activeTab === 'members' && (
        <div className="cd-section">
          <div className="cd-member-list">
            {data.members.map((m, idx) => (
              <div key={m.id} className="cd-member-card" style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="cd-member-avatar" style={{ backgroundImage: m.image ? `url(${m.image})` : 'none' }}>
                  {!m.image && m.name.charAt(0).toUpperCase()}
                </div>
                <div className="cd-member-info">
                  <div className="cd-member-name">
                    {m.name}
                    {m.id === data.id && <span className="cd-member-you">Kamu</span>}
                  </div>
                  <div className="cd-member-email">{m.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className={`cd-member-role ${m.role === 'ADMIN' ? 'admin' : 'member'}`}>
                    <i className={`bi ${m.role === 'ADMIN' ? 'bi-star-fill' : 'bi-person-fill'}`} />
                    {m.role === 'ADMIN' ? 'Komisaris' : 'Anggota'}
                  </span>
                  {data.myRole === 'ADMIN' && m.id !== data.id && m.role !== 'ADMIN' && (
                    <button
                      className="cd-kick-btn"
                      title={`Keluarkan ${m.name}`}
                      disabled={kickingMemberId === m.id}
                      onClick={() => handleKickMember(m.id, m.name)}
                    >
                      {kickingMemberId === m.id
                        ? <span className="cd-spin-sm" />
                        : <i className="bi bi-person-dash-fill" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Tambah/Edit Tugas ── */}
      {showTaskModal && (
        <div className="cd-modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h5 className="cd-modal-title">{taskId ? 'Edit Tugas Kelas' : 'Tambah Tugas Kelas'}</h5>
              <button className="cd-modal-close" onClick={() => setShowTaskModal(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="cd-modal-body">
                <div className="cd-form-group">
                  <label>Judul Tugas <span className="text-danger">*</span></label>
                  <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="Judul tugas..." />
                </div>
                <div className="cd-form-group">
                  <label>Deskripsi</label>
                  <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3} placeholder="Deskripsi tugas..." />
                </div>
                <div className="cd-form-row">
                  <div className="cd-form-group">
                    <label>Deadline</label>
                    <input type="datetime-local" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
                  </div>
                  <div className="cd-form-group">
                    <label>Prioritas</label>
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option value="LOW">🟢 Rendah</option>
                      <option value="MEDIUM">🟡 Sedang</option>
                      <option value="HIGH">🔴 Tinggi</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="cd-modal-footer">
                <button type="button" className="cd-modal-cancel" onClick={() => setShowTaskModal(false)}>Batal</button>
                <button type="submit" className="cd-btn-primary" disabled={savingTask}>
                  {savingTask ? <><span className="cd-spin" /> Menyimpan...</> : 'Simpan Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Announce ── */}
      {showAnnounce && (
        <div className="cd-modal-overlay" onClick={() => setShowAnnounce(false)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h5 className="cd-modal-title">Kirim Pengumuman</h5>
              <button className="cd-modal-close" onClick={() => setShowAnnounce(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={handleSendAnnounce}>
              <div className="cd-modal-body">
                <div className="cd-info-banner">
                  <i className="bi bi-info-circle-fill" />
                  Pesan ini akan dikirim sebagai notifikasi ke seluruh anggota kelas secara instan.
                </div>
                {annSuccess && (
                  <div className="cd-success-banner">
                    <i className="bi bi-check-circle-fill me-2" /> Pengumuman berhasil dikirim!
                  </div>
                )}
                <div className="cd-form-group">
                  <label>Judul / Ringkasan</label>
                  <input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} required placeholder="Contoh: Info Kuliah Kosong" disabled={annSuccess} />
                </div>
                <div className="cd-form-group">
                  <label>Pesan Lengkap</label>
                  <textarea value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} rows={4} required placeholder="Detail pengumuman..." disabled={annSuccess} />
                </div>
              </div>
              <div className="cd-modal-footer">
                <button type="button" className="cd-modal-cancel" onClick={() => setShowAnnounce(false)}>Tutup</button>
                <button type="submit" className="cd-btn-primary" disabled={sendingAnn || annSuccess}>
                  {sendingAnn ? <><span className="cd-spin" /> Mengirim...</> : annSuccess ? <><i className="bi bi-check2 me-1" /> Terkirim!</> : <><i className="bi bi-send-fill me-1" /> Kirim Notif</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Schedule Editor ── */}
      {showScheduleModal && (
        <div className="cd-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="cd-modal cd-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="cd-modal-header">
              <div>
                <h5 className="cd-modal-title">{hasSchedule ? 'Ubah Jadwal Kelas' : 'Tambah Jadwal Kelas'}</h5>
                <p className="cd-modal-sub">{hasSchedule ? 'Jadwal ini akan tetap aktif setiap minggu.' : 'Jadwal pertama akan menjadi jadwal tetap kelas ini.'}</p>
              </div>
              <button className="cd-modal-close" onClick={() => setShowScheduleModal(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="cd-modal-body">
              {!hasSchedule && (
                <div className="cd-info-banner mb-3">
                  <i className="bi bi-lightbulb-fill" />
                  Setelah jadwal dibuat, kamu hanya perlu mengubah mode pertemuan setiap minggu (Sinkron Maya / Langsung) — tanpa perlu input ulang jadwal.
                </div>
              )}
              <div className="cd-sched-slots">
                {scheduleSlots.map((slot, i) => (
                  <div key={i} className="cd-sched-slot-row">
                    <select value={slot.dayOfWeek} onChange={(e) => {
                      const next = [...scheduleSlots]
                      next[i] = { ...next[i], dayOfWeek: Number(e.target.value) }
                      setScheduleSlots(next)
                    }}>
                      {/* Monday-first: 0=Senin ... 6=Minggu */}
                      {DAYS.map((d, di) => <option key={di} value={di}>{d}</option>)}
                    </select>
                    <input placeholder="Nama matkul / kegiatan" value={slot.title} onChange={(e) => {
                      const next = [...scheduleSlots]; next[i] = { ...next[i], title: e.target.value }; setScheduleSlots(next)
                    }} />
                    <input type="time" value={slot.startTime} onChange={(e) => {
                      const next = [...scheduleSlots]; next[i] = { ...next[i], startTime: e.target.value }; setScheduleSlots(next)
                    }} />
                    <input type="time" value={slot.endTime} onChange={(e) => {
                      const next = [...scheduleSlots]; next[i] = { ...next[i], endTime: e.target.value }; setScheduleSlots(next)
                    }} />
                    <input placeholder="Ruangan (opsional)" value={slot.place} onChange={(e) => {
                      const next = [...scheduleSlots]; next[i] = { ...next[i], place: e.target.value }; setScheduleSlots(next)
                    }} />
                    <button type="button" className="cd-sched-remove" onClick={() => setScheduleSlots(scheduleSlots.filter((_, si) => si !== i))}>
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="cd-sched-add-btn" onClick={() => setScheduleSlots([...scheduleSlots, { dayOfWeek: 1, title: '', startTime: '', endTime: '', place: '' }])}>
                <i className="bi bi-plus-lg" /> Tambah Jadwal
              </button>
            </div>
            <div className="cd-modal-footer">
              <button type="button" className="cd-modal-cancel" onClick={() => setShowScheduleModal(false)}>Batal</button>
              <button type="button" className="cd-btn-primary" onClick={handleSaveSchedule} disabled={savingSchedule}>
                {savingSchedule ? <><span className="cd-spin" /> Menyimpan...</> : 'Simpan Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Group Settings ── */}
      {showSettingsModal && (
        <div className="cd-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="cd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="cd-modal-header">
              <div>
                <h5 className="cd-modal-title">Pengaturan Kelas</h5>
                <p className="cd-modal-sub">Ubah informasi &amp; pengaturan notifikasi kelas</p>
              </div>
              <button className="cd-modal-close" onClick={() => setShowSettingsModal(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <div className="cd-modal-body">
              {/* Info Kelas */}
              <div className="cd-settings-section-title">📝 Informasi Kelas</div>
              {settingsError && (
                <div className="cd-alert-error mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2" />{settingsError}
                </div>
              )}
              <div className="cd-form-group">
                <label>Nama Kelas <span style={{color:'#ef4444'}}>*</span></label>
                <input type="text" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} placeholder="Nama kelas..." />
              </div>
              <div className="cd-form-group">
                <label>Deskripsi</label>
                <textarea value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)} rows={2} placeholder="Deskripsi kelas..." />
              </div>
              <div className="cd-form-group">
                <label>Jurusan / Grup</label>
                <input type="text" value={settingsSubject} onChange={(e) => setSettingsSubject(e.target.value)} placeholder="Contoh: Teknik Informatika" />
              </div>

              {/* Notification Settings */}
              <div className="cd-settings-section-title" style={{ marginTop: 20 }}>🔔 Pengaturan Notifikasi Kelas</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--sh-muted)', marginBottom: 12 }}>
                Pilih kapan reminder dikirim ke <strong>semua anggota</strong> untuk tugas dan jadwal kelas ini.
              </p>
              <div style={{ marginBottom: 12 }}>
                <div className="cd-notif-label">⏰ Reminder Deadline Tugas Kelas</div>
                <div className="cd-interval-row">
                  {[{v:120,l:'2 Jam'},{v:60,l:'1 Jam'},{v:30,l:'30 Menit'},{v:10,l:'10 Menit'},{v:5,l:'5 Menit'},{v:1,l:'1 Menit'}].map((iv) => (
                    <button key={iv.v} type="button" className={`cd-interval-btn ${classTaskReminders.includes(iv.v) ? 'active' : ''}`}
                      onClick={() => setClassTaskReminders((prev) => prev.includes(iv.v) ? prev.filter((x)=>x!==iv.v) : [...prev, iv.v].sort((a,b)=>b-a))}>
                      {classTaskReminders.includes(iv.v) && <i className="bi bi-check-lg me-1" />}{iv.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div className="cd-notif-label">📅 Reminder Jadwal Kuliah Kelas</div>
                <div className="cd-interval-row">
                  {[{v:120,l:'2 Jam'},{v:60,l:'1 Jam'},{v:30,l:'30 Menit'},{v:10,l:'10 Menit'},{v:5,l:'5 Menit'},{v:1,l:'1 Menit'}].map((iv) => (
                    <button key={iv.v} type="button" className={`cd-interval-btn ${classScheduleReminders.includes(iv.v) ? 'active' : ''}`}
                      onClick={() => setClassScheduleReminders((prev) => prev.includes(iv.v) ? prev.filter((x)=>x!==iv.v) : [...prev, iv.v].sort((a,b)=>b-a))}>
                      {classScheduleReminders.includes(iv.v) && <i className="bi bi-check-lg me-1" />}{iv.l}
                    </button>
                  ))}
                </div>
              </div>
              {classNotifSuccess && (
                <div className="cd-alert-success"><i className="bi bi-check-circle-fill me-2" />Pengaturan notifikasi kelas disimpan!</div>
              )}
              <button type="button" className="cd-btn-secondary" style={{ marginTop: 8 }} onClick={handleSaveClassNotif} disabled={savingClassNotif}>
                {savingClassNotif ? <><span className="cd-spin-sm" /> Menyimpan...</> : <><i className="bi bi-bell me-1" />Simpan Pengaturan Notifikasi</>}
              </button>
            </div>
            <div className="cd-modal-footer">
              <button type="button" className="cd-modal-cancel" onClick={() => setShowSettingsModal(false)}>Tutup</button>
              <button type="button" className="cd-btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? <><span className="cd-spin" /> Menyimpan...</> : <><i className="bi bi-check2 me-1" /> Simpan Info Kelas</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Loading ─────────────────────────────────────── */
        .cd-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 40vh; gap: 16px;
        }
        .cd-spinner {
          width: 44px; height: 44px;
          border: 4px solid var(--sh-border);
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: cd-spin 0.9s linear infinite;
        }
        .cd-loading-text { font-size: 0.9rem; color: var(--sh-muted); font-weight: 600; }

        /* ── Skeleton Loader ──────────────────────────────── */
        .cd-skeleton-wrap { padding-bottom: 16px; }
        .cd-skeleton-header {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px; border-radius: 20px;
          background: var(--sh-card-bg); border: 1px solid var(--sh-border);
          margin-bottom: 16px;
        }
        .cd-sk {
          background: linear-gradient(90deg, var(--sh-border) 25%, rgba(255,255,255,0.05) 50%, var(--sh-border) 75%);
          background-size: 200% 100%;
          animation: cd-shimmer 1.4s infinite ease-in-out;
        }
        @keyframes cd-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Wrap ────────────────────────────────────────── */
        .cd-wrap { display: flex; flex-direction: column; gap: 0; padding-bottom: 32px; }

        /* ── Header ──────────────────────────────────────── */
        .cd-header {
          display: flex; flex-direction: column;
          gap: 14px; padding: 16px 20px;
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 20px;
          margin-bottom: 16px;
          animation: cd-fadeUp 0.4s ease;
        }
        .cd-header-top-row {
          display: flex; align-items: center; justify-content: space-between;
        }
        .cd-header-left { display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 0; flex-wrap: wrap; }
        .cd-btn-icon {
          width: 36px; height: 36px; border-radius: 50%;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-bg); color: var(--sh-muted);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem; cursor: pointer;
          transition: all 0.18s ease;
        }
        .cd-btn-icon:hover { color: #4f46e5; border-color: #4f46e5; background: #eef2ff; }
        .cd-back-link {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-bg);
          color: var(--sh-muted);
          text-decoration: none;
          font-size: 1rem;
          transition: all 0.18s ease;
          flex-shrink: 0;
          align-self: flex-start;
        }
        .cd-back-link:hover { color: #4f46e5; border-color: #4f46e5; background: #eef2ff; transform: scale(1.08); }

        .cd-header-avatar {
          width: 56px; height: 56px; flex-shrink: 0;
          border-radius: 16px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: 800;
        }
        .cd-title {
          font-size: 1.2rem; font-weight: 800;
          color: var(--sh-text); margin: 0 0 4px;
          letter-spacing: -0.3px;
        }
        .cd-subtitle { font-size: 0.82rem; color: var(--sh-muted); font-weight: 500; margin: 0 0 10px; }
        .cd-badges { display: flex; flex-wrap: wrap; gap: 8px; }
        .cd-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px; border-radius: 999px;
          font-size: 0.75rem; font-weight: 700;
        }
        .cd-badge.code { background: #fef3c7; color: #92400e; font-family: monospace; }
        .cd-badge.role.admin { background: #eef2ff; color: #4f46e5; }
        .cd-badge.role.member { background: #f1f5f9; color: #64748b; border: 1px solid var(--sh-border); }

        .cd-header-actions { display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; flex-shrink: 0; align-items: center; }
        @media (max-width: 480px) {
          .cd-header-actions { flex-direction: row; }
        }

        /* ── Buttons ─────────────────────────────────────── */
        .cd-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 20px; border-radius: 999px; border: none;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; font-size: 0.875rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .cd-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35); }
        .cd-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .cd-btn-danger {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 16px; border-radius: 999px;
          border: 1.5px solid #fecaca;
          background: #fef2f2; color: #dc2626;
          font-size: 0.875rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .cd-btn-danger:hover { background: #fee2e2; border-color: #ef4444; }

        .cd-btn-secondary {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 16px; border-radius: 999px;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-card-bg); color: var(--sh-text);
          font-size: 0.875rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .cd-btn-secondary:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }

        .cd-code-eye {
          background: none; border: none; padding: 0 2px; margin-left: 2px;
          cursor: pointer; color: inherit; opacity: 0.7;
          font-size: 0.75rem; line-height: 1; transition: opacity 0.15s;
          display: inline-flex; align-items: center;
        }
        .cd-code-eye:hover { opacity: 1; }

        .cd-kick-btn {
          width: 30px; height: 30px; border-radius: 50%;
          border: 1.5px solid #fecaca;
          background: #fef2f2; color: #dc2626;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 0.8rem; cursor: pointer;
          transition: all 0.18s ease; flex-shrink: 0;
        }
        .cd-kick-btn:hover:not(:disabled) { background: #fee2e2; border-color: #ef4444; transform: scale(1.1); }
        .cd-kick-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 480px) {
          .cd-btn-text { display: none; }
          .cd-btn-primary, .cd-btn-danger, .cd-btn-secondary { padding: 9px 13px; }
        }

        /* ── Tabs ────────────────────────────────────────── */
        .cd-tabs-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          margin-bottom: 16px;
        }
        .cd-tabs-wrap::-webkit-scrollbar { display: none; }
        .cd-tabs {
          display: flex; gap: 8px;
          padding: 4px;
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 16px;
          width: max-content;
          min-width: 100%;
        }
        .cd-tab {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 20px; border-radius: 12px; border: none;
          background: transparent; color: var(--sh-muted);
          font-size: 0.875rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease;
          white-space: nowrap; flex: 1;
          justify-content: center;
        }
        .cd-tab:hover { background: var(--sh-bg); color: var(--sh-text); }
        .cd-tab.active { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
        .cd-tab-badge {
          background: rgba(255,255,255,0.25);
          color: inherit;
          padding: 2px 8px; border-radius: 999px;
          font-size: 0.72rem; font-weight: 800;
        }
        .cd-tab:not(.active) .cd-tab-badge { background: var(--sh-border); color: var(--sh-muted); }

        /* ── Section ─────────────────────────────────────── */
        .cd-section { animation: cd-fadeUp 0.3s ease; }
        .cd-section-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .cd-section-toolbar-left { justify-content: flex-start; }
        .cd-empty {
          text-align: center; padding: 60px 20px;
          color: var(--sh-muted);
          background: var(--sh-bg);
          border-radius: 20px;
          border: 2px dashed var(--sh-border);
        }
        .cd-empty i { font-size: 3rem; display: block; margin-bottom: 12px; opacity: 0.5; }
        .cd-empty p { font-size: 0.9rem; font-weight: 600; margin: 0; }

        /* ── Tasks ───────────────────────────────────────── */
        .cd-task-list { display: flex; flex-direction: column; gap: 10px; }
        .cd-task-card {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px;
          background: var(--sh-card-bg);
          border: 1.5px solid var(--sh-border);
          border-radius: 16px;
          padding: 16px 18px;
          animation: cd-fadeUp 0.35s ease both;
          transition: box-shadow 0.2s ease;
        }
        .cd-task-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); }
        .cd-task-body { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
        .cd-priority-dot {
          width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 6px;
        }
        .cd-priority-dot.high { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }
        .cd-priority-dot.medium { background: #f59e0b; }
        .cd-priority-dot.low { background: #10b981; }
        .cd-task-title { font-size: 1rem; font-weight: 800; color: var(--sh-text); margin: 0 0 4px; }
        .cd-task-desc { font-size: 0.82rem; color: var(--sh-muted); margin: 0 0 10px; line-height: 1.6; }
        .cd-task-meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .cd-meta-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px;
          background: var(--sh-bg); border: 1px solid var(--sh-border);
          font-size: 0.75rem; font-weight: 600; color: var(--sh-muted);
        }
        .cd-prio-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px; border-radius: 999px;
          font-size: 0.75rem; font-weight: 700;
        }
        .cd-prio-badge.high { background: #fee2e2; color: #dc2626; }
        .cd-prio-badge.medium { background: #fef3c7; color: #d97706; }
        .cd-prio-badge.low { background: #d1fae5; color: #059669; }

        .cd-task-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
        .cd-action-btn {
          width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--sh-border);
          display: flex; align-items: center; justify-content: center;
          background: var(--sh-bg); font-size: 0.9rem;
          cursor: pointer; transition: all 0.15s ease;
        }
        .cd-action-btn.edit { color: #4f46e5; }
        .cd-action-btn.edit:hover { background: #eef2ff; border-color: #4f46e5; }
        .cd-action-btn.delete { color: #ef4444; }
        .cd-action-btn.delete:hover { background: #fee2e2; border-color: #fecaca; }

        /* ── Announcements ────────────────────────────────── */
        .cd-ann-feed { display: flex; flex-direction: column; gap: 12px; }
        .cd-ann-card {
          display: flex; gap: 14px; align-items: flex-start;
          padding: 16px 18px; border-radius: 16px;
          background: var(--sh-card-bg); border: 1px solid var(--sh-border);
          animation: cd-fadeUp 0.4s ease both;
          transition: box-shadow 0.18s ease;
        }
        .cd-ann-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
        .cd-ann-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 800; overflow: hidden;
        }
        .cd-ann-body { flex: 1; min-width: 0; }
        .cd-ann-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
        .cd-ann-meta-left { justify-content: flex-start; }
        .cd-ann-sender { font-size: 0.82rem; font-weight: 700; color: #4f46e5; }
        .cd-ann-time { font-size: 0.75rem; color: var(--sh-muted); }
        .cd-ann-title { font-size: 0.95rem; font-weight: 800; color: var(--sh-text); margin-bottom: 4px; }
        .cd-ann-msg { font-size: 0.84rem; color: var(--sh-muted); margin: 0; line-height: 1.65; white-space: pre-wrap; }

        /* ── Schedule ────────────────────────────────────── */

        .cd-schedule-toolbar { margin-bottom: 16px; }
        .cd-schedule-info {
          display: flex; align-items: center; gap: 14px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          border: 1.5px solid #c7d2fe;
          border-radius: 16px;
          padding: 14px 18px;
          flex-wrap: wrap;
        }
        .cd-schedule-info-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: #4f46e5; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; flex-shrink: 0;
        }
        .cd-schedule-info-title { font-size: 0.9rem; font-weight: 800; color: #312e81; }
        .cd-schedule-info-sub { font-size: 0.78rem; color: #4338ca; font-weight: 500; }
        .cd-schedule-info-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; margin-left: auto; }

        .cd-mode-all-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          border: 1.5px solid #a5b4fc;
          background: white; color: #4f46e5;
          font-size: 0.8rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease;
        }
        .cd-mode-all-btn:hover:not(:disabled) { background: #4f46e5; color: white; }
        .cd-mode-all-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .cd-edit-sched-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          border: 1.5px solid var(--sh-border);
          background: white; color: var(--sh-text);
          font-size: 0.8rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s ease;
        }
        .cd-edit-sched-btn:hover { border-color: #4f46e5; color: #4f46e5; }

        .cd-schedule-empty-admin {
          display: flex; align-items: center; gap: 14px;
          background: #fffbeb; border: 1.5px solid #fde68a;
          border-radius: 16px; padding: 14px 18px; flex-wrap: wrap;
          font-size: 1.5rem; color: #d97706;
        }
        .cd-schedule-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
        .cd-slot-card {
          background: var(--sh-card-bg);
          border: 1.5px solid var(--sh-border);
          border-radius: 16px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 8px;
          animation: cd-fadeUp 0.35s ease both;
          transition: box-shadow 0.2s ease;
        }
        .cd-slot-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
        .cd-slot-day {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px;
          font-size: 0.78rem; font-weight: 800;
          align-self: flex-start;
        }
        .cd-slot-mode-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 999px;
          font-size: 0.72rem; font-weight: 700;
          align-self: flex-start;
        }
        .cd-slot-title { font-size: 1rem; font-weight: 800; color: var(--sh-text); margin: 0; }
        .cd-slot-meta { display: flex; flex-direction: column; gap: 5px; font-size: 0.8rem; font-weight: 600; color: var(--sh-muted); }
        .cd-slot-meta i { font-size: 0.85rem; margin-right: 4px; }
        .cd-slot-toggle {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 999px;
          border: 1.5px solid var(--sh-border);
          background: var(--sh-bg); color: var(--sh-muted);
          font-size: 0.75rem; font-weight: 700;
          cursor: pointer; transition: all 0.15s ease;
          margin-top: 4px;
        }
        .cd-slot-toggle:hover:not(:disabled) { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
        .cd-slot-toggle:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Live Meeting Box ─────────────────────────────── */
        .cd-live-meeting-box {
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          border: 1.5px solid #c7d2fe;
          border-radius: 12px;
          padding: 10px 12px;
          display: flex; flex-direction: column; gap: 8px;
          margin-top: 2px;
        }
        .cd-live-meeting-label {
          font-size: 0.78rem; font-weight: 800; color: #4338ca;
          display: flex; align-items: center; gap: 5px;
        }
        .cd-live-optional {
          font-size: 0.68rem; font-weight: 500; color: #818cf8;
          margin-left: 2px;
        }
        .cd-live-input-row {
          display: flex; gap: 6px; align-items: center;
        }
        .cd-live-input {
          flex: 1; min-width: 0;
          padding: 7px 10px;
          border: 1.5px solid #a5b4fc;
          border-radius: 8px;
          background: white;
          color: #1e1b4b;
          font-size: 0.78rem; font-weight: 500;
          outline: none;
          transition: border-color 0.2s;
        }
        .cd-live-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .cd-live-save-btn {
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          border: 1.5px solid #6366f1;
          background: #4f46e5; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; cursor: pointer;
          transition: all 0.15s ease;
        }
        .cd-live-save-btn:hover:not(:disabled) { background: #4338ca; }
        .cd-live-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cd-live-link {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          background: #4f46e5; color: white;
          font-size: 0.78rem; font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
          align-self: flex-start;
        }
        .cd-live-link:hover { background: #4338ca; color: white; transform: translateY(-1px); }
        .cd-live-empty {
          font-size: 0.75rem; color: #818cf8; font-style: italic;
        }

        /* ── Members ─────────────────────────────────────── */
        .cd-member-list { display: flex; flex-direction: column; gap: 8px; }
        .cd-member-card {
          display: flex; align-items: center; gap: 14px;
          background: var(--sh-card-bg);
          border: 1.5px solid var(--sh-border);
          border-radius: 14px;
          padding: 12px 16px;
          animation: cd-fadeUp 0.35s ease both;
          transition: box-shadow 0.15s ease;
        }
        .cd-member-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .cd-member-avatar {
          width: 44px; height: 44px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; font-weight: 800;
          background-size: cover; background-position: center;
        }
        .cd-member-info { flex: 1; min-width: 0; }
        .cd-member-name { font-size: 0.9rem; font-weight: 800; color: var(--sh-text); display: flex; align-items: center; gap: 6px; }
        .cd-member-you { font-size: 0.72rem; background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
        .cd-member-email { font-size: 0.78rem; color: var(--sh-muted); font-weight: 500; }
        .cd-member-role {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 14px; border-radius: 999px;
          font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
        }
        .cd-member-role.admin { background: #eef2ff; color: #4f46e5; }
        .cd-member-role.member { background: #f1f5f9; color: #64748b; border: 1px solid var(--sh-border); }

        /* ── Modals ──────────────────────────────────────── */
        .cd-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(6px);
          z-index: 1050;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: cd-fadeIn 0.2s ease;
        }
        .cd-modal {
          background: var(--sh-card-bg);
          border-radius: 24px;
          width: 100%; max-width: 500px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.2);
          animation: cd-modalIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          max-height: 90vh; overflow-y: auto;
        }
        .cd-modal-lg { max-width: 680px; }
        .cd-modal-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 20px 0; gap: 12px;
          position: sticky; top: 0;
          background: var(--sh-card-bg);
          z-index: 1;
        }
        .cd-modal-title { font-size: 1rem; font-weight: 800; color: var(--sh-text); margin: 0 0 2px; }
        .cd-modal-sub { font-size: 0.78rem; color: var(--sh-muted); margin: 0; font-weight: 500; }
        .cd-modal-close {
          width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid var(--sh-border); background: var(--sh-bg);
          color: var(--sh-muted); display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 13px; flex-shrink: 0; transition: all 0.15s;
        }
        .cd-modal-close:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
        .cd-modal-body { padding: 16px 20px; }
        .cd-modal-footer {
          display: flex; align-items: center; justify-content: flex-end; gap: 10px;
          padding: 12px 20px 20px;
          position: sticky; bottom: 0;
          background: var(--sh-card-bg);
        }
        .cd-modal-cancel {
          padding: 9px 20px; border-radius: 999px;
          border: 1.5px solid var(--sh-border); background: var(--sh-bg);
          color: var(--sh-muted); font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .cd-modal-cancel:hover { background: #f1f5f9; }

        /* ── Form ─────────────────────────────────────────── */
        .cd-form-group { margin-bottom: 14px; }
        .cd-form-group label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--sh-text); margin-bottom: 6px; }
        .cd-form-group input,
        .cd-form-group textarea,
        .cd-form-group select {
          width: 100%; padding: 10px 14px;
          border: 1.5px solid var(--sh-border); border-radius: 12px;
          background: var(--sh-bg); color: var(--sh-text);
          font-size: 0.875rem; font-weight: 500; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cd-form-group input:focus,
        .cd-form-group textarea:focus,
        .cd-form-group select:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
        }
        .cd-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 400px) { .cd-form-row { grid-template-columns: 1fr; } }

        /* ── Schedule Slots Editor ───────────────────────── */
        .cd-sched-slots { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
        .cd-sched-slot-row {
          display: grid;
          grid-template-columns: 100px 1fr 80px 80px 1fr 36px;
          gap: 8px; align-items: center;
        }
        .cd-sched-slot-row select,
        .cd-sched-slot-row input {
          padding: 8px 10px;
          border: 1.5px solid var(--sh-border); border-radius: 10px;
          background: var(--sh-bg); color: var(--sh-text);
          font-size: 0.82rem; font-weight: 500; outline: none;
          transition: border-color 0.2s;
        }
        .cd-sched-slot-row select:focus,
        .cd-sched-slot-row input:focus { border-color: #4f46e5; }
        .cd-sched-remove {
          width: 36px; height: 36px; border-radius: 10px;
          border: 1px solid #fecaca; background: #fee2e2; color: #dc2626;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 0.85rem; transition: all 0.15s;
        }
        .cd-sched-remove:hover { background: #fecaca; }
        @media (max-width: 600px) {
          .cd-sched-slot-row { grid-template-columns: 1fr 1fr; }
        }
        .cd-sched-add-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          border: 1.5px dashed var(--sh-border);
          background: var(--sh-bg); color: var(--sh-muted);
          font-size: 0.82rem; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
        }
        .cd-sched-add-btn:hover { border-color: #4f46e5; color: #4f46e5; }

        /* Banners */
        .cd-info-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: #eff6ff; border: 1px solid #bfdbfe;
          border-radius: 12px; padding: 10px 14px;
          font-size: 0.82rem; font-weight: 600; color: #1e40af;
          margin-bottom: 14px;
        }
        .cd-success-banner {
          display: flex; align-items: center;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 12px; padding: 10px 14px;
          font-size: 0.82rem; font-weight: 700; color: #059669;
          margin-bottom: 14px;
        }
        .cd-alert-error {
          display: flex; align-items: center;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 12px; padding: 10px 14px;
          font-size: 0.82rem; font-weight: 600; color: #dc2626;
        }
        .cd-alert-success {
          display: flex; align-items: center;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 12px; padding: 10px 14px;
          font-size: 0.82rem; font-weight: 700; color: #059669;
          margin-top: 8px; margin-bottom: 8px;
        }

        /* ── Notification Settings in Modal ──────────────── */
        .cd-settings-section-title {
          font-size: 0.85rem; font-weight: 800; color: var(--sh-text);
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid var(--sh-border);
        }
        .cd-notif-label {
          font-size: 0.78rem; font-weight: 700; color: var(--sh-muted);
          text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;
        }
        .cd-interval-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .cd-interval-btn {
          display: inline-flex; align-items: center;
          padding: 6px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 700;
          cursor: pointer; transition: all 0.18s ease;
          background: var(--sh-bg); color: var(--sh-muted);
          border: 1.5px solid var(--sh-border);
        }
        .cd-interval-btn.active {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white; border-color: transparent;
        }
        .cd-interval-btn:hover:not(.active) { border-color: #4f46e5; color: #4f46e5; }

        /* ── Spinners ────────────────────────────────────── */
        .cd-spin {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: cd-spin 0.7s linear infinite;
        }
        .cd-spin-sm {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(79,70,229,0.2);
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: cd-spin 0.7s linear infinite;
        }

        /* ── Keyframes ───────────────────────────────────── */
        @keyframes cd-spin { to { transform: rotate(360deg); } }
        @keyframes cd-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cd-fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cd-modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
