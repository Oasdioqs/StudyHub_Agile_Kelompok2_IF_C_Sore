'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * SessionModeToggle
 * - Untuk jadwal KELAS di kalender: selalu read-only (badge saja), karena mode hanya bisa diubah dari halaman kelas.
 * - Untuk jadwal PERSONAL: bisa toggle + input link meeting.
 * - Prop `onModeLoaded` callback opsional → kirim {mode, url} ke parent agar parent bisa render "Buka Live Meeting" di posisi lain.
 */
export function SessionModeToggle({
  slotId, slotType, dateStr, groupId, isAdmin,
  onModeLoaded,
}: {
  slotId: string
  slotType: 'personal' | 'class'
  dateStr: string
  groupId?: string
  isAdmin?: boolean
  onModeLoaded?: (info: { mode: 'LANGSUNG' | 'MAYA'; url: string }) => void
}) {
  const [mode, setMode] = useState<'LANGSUNG' | 'MAYA'>('LANGSUNG')
  const [loading, setLoading] = useState(true)
  const [liveMeetingUrl, setLiveMeetingUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/session-mode?slotId=${slotId}&slotType=${slotType}&date=${dateStr}`)
      .then(res => res.json())
      .then(data => {
        const m = data.mode || 'LANGSUNG'
        setMode(m)
        const note = data.record?.note || data.note || ''
        if (note) { setLiveMeetingUrl(note); setSavedUrl(note) }
        setLoading(false)
        onModeLoaded?.({ mode: m, url: note })
      })
      .catch(() => setLoading(false))
  }, [slotId, slotType, dateStr])

  useEffect(() => {
    if (showUrlInput && inputRef.current) inputRef.current.focus()
  }, [showUrlInput])

  const toggleMode = async () => {
    const newMode = mode === 'LANGSUNG' ? 'MAYA' : 'LANGSUNG'
    setMode(newMode)
    if (newMode === 'MAYA' && slotType === 'personal') {
      setShowUrlInput(true)
    } else {
      setShowUrlInput(false)
    }
    await fetch('/api/session-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, slotType, date: dateStr, mode: newMode, groupId })
    }).catch(() => setMode(mode))
    onModeLoaded?.({ mode: newMode, url: savedUrl })
  }

  const handleSaveUrl = async () => {
    setSavingUrl(true)
    try {
      await fetch('/api/session-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, slotType, date: dateStr, mode, groupId, note: liveMeetingUrl.trim() || null })
      })
      setSavedUrl(liveMeetingUrl.trim())
      setShowUrlInput(false)
      onModeLoaded?.({ mode, url: liveMeetingUrl.trim() })
    } catch {
    } finally {
      setSavingUrl(false)
    }
  }

  if (loading) return <span className="spinner-border spinner-border-sm text-primary" style={{ width: '12px', height: '12px' }}></span>

  // ── Jadwal KELAS di kalender: SELALU read-only badge (termasuk komisaris) ──
  // Mode hanya bisa diubah dari halaman kelas, bukan dari kalender
  if (slotType === 'class') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 700, padding: '4px 10px',
          borderRadius: '12px',
          background: mode === 'MAYA' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
        }}
        title="Mode hanya bisa diubah dari halaman kelas"
      >
        <i className={`bi ${mode === 'MAYA' ? 'bi-laptop' : 'bi-person-video3'}`}></i>
        {mode === 'MAYA' ? 'Sesi Daring' : 'Sesi Luring'}
      </span>
    )
  }

  // ── Jadwal PERSONAL: bisa toggle ──
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
      <button
        onClick={toggleMode}
        className="btn btn-sm d-flex align-items-center gap-1 fw-bold border-0 shadow-sm"
        style={{
          cursor: 'pointer',
          fontSize: '11px',
          padding: '4px 10px',
          borderRadius: '12px',
          background: mode === 'MAYA' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          transition: 'all 0.2s ease',
          transform: 'translateY(-1px)'
        }}
        title="Klik untuk ubah mode"
      >
        <i className={`bi ${mode === 'MAYA' ? 'bi-laptop' : 'bi-person-video3'}`}></i>
        {mode === 'MAYA' ? 'Sesi Daring' : 'Sesi Luring'}
      </button>

      {/* Input live meeting muncul saat toggle ke MAYA (personal) */}
      {showUrlInput && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '6px',
          background: 'var(--sh-card-bg)', border: '1.5px solid #a5b4fc',
          borderRadius: '12px', padding: '10px 12px',
          boxShadow: '0 4px 20px rgba(79,70,229,0.15)',
          minWidth: '240px', zIndex: 10, position: 'relative',
          animation: 'smt-drop 0.2s ease'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#4338ca', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="bi bi-camera-video-fill"></i> Link Live Meeting
            <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 500 }}>(opsional)</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              ref={inputRef}
              type="url"
              value={liveMeetingUrl}
              onChange={e => setLiveMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              style={{
                flex: 1, padding: '6px 10px', borderRadius: '8px',
                border: '1.5px solid #a5b4fc', fontSize: '11px',
                background: 'var(--sh-bg)', color: 'var(--sh-text)',
                outline: 'none'
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveUrl() }}
            />
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={savingUrl}
              style={{
                background: '#4f46e5', color: 'white', border: 'none',
                borderRadius: '8px', padding: '0 10px', cursor: 'pointer',
                fontSize: '13px', flexShrink: 0
              }}
              title="Simpan"
            >
              {savingUrl ? '…' : <i className="bi bi-check-lg"></i>}
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              style={{
                background: 'var(--sh-bg)', color: 'var(--sh-muted)', border: '1px solid var(--sh-border)',
                borderRadius: '8px', padding: '0 8px', cursor: 'pointer',
                fontSize: '12px', flexShrink: 0
              }}
              title="Tutup"
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        </div>
      )}

      {/* Tampilkan link kalau tersimpan dan mode MAYA (personal only) */}
      {mode === 'MAYA' && savedUrl && !showUrlInput && (
        <a
          href={savedUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 700, color: '#4f46e5',
            textDecoration: 'none', padding: '3px 8px',
            background: '#eef2ff', borderRadius: '8px',
            border: '1px solid #c7d2fe'
          }}
        >
          <i className="bi bi-camera-video-fill"></i> Buka Live Meeting
        </a>
      )}
      <style>{`@keyframes smt-drop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </span>
  )
}

export function AttendanceSelect({ slotId, slotType, dateStr }: { slotId: string, slotType: 'personal' | 'class', dateStr: string }) {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/attendance?date=${dateStr}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const record = data.find(d => d.slotId === slotId && d.slotType === slotType)
          if (record) setStatus(record.status)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slotId, slotType, dateStr])

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    setIsOpen(false)
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, slotType, date: dateStr, status: newStatus })
    }).catch(() => {})
  }

  const toggleDropdown = () => setIsOpen(!isOpen)

  if (loading) return null

  const statusColors: Record<string, string> = {
    '': 'transparent',
    'HADIR': 'rgba(16, 185, 129, 0.13)',
    'TIDAK_HADIR': 'rgba(239, 68, 68, 0.13)',
    'SAKIT': 'rgba(245, 158, 11, 0.13)',
    'IZIN': 'rgba(59, 130, 246, 0.13)',
  }
  const statusTextColors: Record<string, string> = {
    '': 'var(--sh-muted)',
    'HADIR': '#059669',
    'TIDAK_HADIR': '#dc2626',
    'SAKIT': '#d97706',
    'IZIN': '#2563eb',
  }
  const statusBorderColors: Record<string, string> = {
    '': 'var(--sh-border)',
    'HADIR': 'rgba(16, 185, 129, 0.45)',
    'TIDAK_HADIR': 'rgba(239, 68, 68, 0.45)',
    'SAKIT': 'rgba(245, 158, 11, 0.45)',
    'IZIN': 'rgba(59, 130, 246, 0.45)',
  }
  const statusLabels: Record<string, string> = {
    '': 'Belum Set Presensi',
    'HADIR': 'Hadir',
    'TIDAK_HADIR': 'Absen',
    'SAKIT': 'Sakit',
    'IZIN': 'Izin',
  }

  return (
    <div className="position-relative d-inline-block ms-auto ms-sm-2 mt-2 mt-sm-0 flex-shrink-0" style={{ zIndex: isOpen ? 9999 : 2 }}>
      <button
        type="button"
        className="btn btn-sm d-flex align-items-center gap-2 fw-bold"
        onClick={toggleDropdown}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{
          background: statusColors[status] ?? statusColors[''],
          color: statusTextColors[status] ?? statusTextColors[''],
          borderRadius: '12px',
          fontSize: '11px',
          padding: '4px 12px',
          border: `1px solid ${statusBorderColors[status] ?? statusBorderColors['']}`,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap'
        }}
      >
        <i className={`bi ${status === 'HADIR' ? 'bi-check-circle-fill' : status === 'TIDAK_HADIR' ? 'bi-x-circle-fill' : status === 'SAKIT' ? 'bi-thermometer-half' : status === 'IZIN' ? 'bi-envelope-paper-fill' : 'bi-question-circle text-primary'}`}></i>
        {statusLabels[status] || statusLabels['']}
        <i className="bi bi-chevron-down" style={{ fontSize: '9px', opacity: 0.9 }}></i>
      </button>
      {isOpen && (
        <ul className="dropdown-menu dropdown-menu-end show shadow border-0 position-absolute" style={{ top: '100%', right: 0, marginTop: '4px', borderRadius: '16px', overflow: 'hidden', minWidth: '160px', zIndex: 9999, background: 'var(--sh-card-bg)' }}>
          <li><button type="button" className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px', color: 'var(--sh-text)' }} onClick={() => handleStatusChange('HADIR')}><i className="bi bi-check-circle text-success me-2"></i>Hadir</button></li>
          <li><button type="button" className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px', color: 'var(--sh-text)' }} onClick={() => handleStatusChange('IZIN')}><i className="bi bi-envelope-paper text-primary me-2"></i>Izin</button></li>
          <li><button type="button" className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px', color: 'var(--sh-text)' }} onClick={() => handleStatusChange('SAKIT')}><i className="bi bi-thermometer text-warning me-2"></i>Sakit</button></li>
          <li><hr className="dropdown-divider m-0" /></li>
          <li><button type="button" className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px', color: 'var(--sh-text)' }} onClick={() => handleStatusChange('TIDAK_HADIR')}><i className="bi bi-x-circle text-danger me-2"></i>Absen (Tidak Hadir)</button></li>
        </ul>
      )}
    </div>
  )
}
