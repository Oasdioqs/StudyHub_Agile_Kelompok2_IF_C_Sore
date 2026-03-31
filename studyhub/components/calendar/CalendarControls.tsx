'use client'

import { useState, useEffect } from 'react'

export function SessionModeToggle({ slotId, slotType, dateStr, groupId, isAdmin }: { slotId: string, slotType: 'personal' | 'class', dateStr: string, groupId?: string, isAdmin?: boolean }) {
  const [mode, setMode] = useState<'LANGSUNG' | 'MAYA'>('LANGSUNG')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/session-mode?slotId=${slotId}&slotType=${slotType}&date=${dateStr}`)
      .then(res => res.json())
      .then(data => {
        if (data.mode) setMode(data.mode)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slotId, slotType, dateStr])

  const toggleMode = async () => {
    if (slotType === 'class' && !isAdmin) return
    const newMode = mode === 'LANGSUNG' ? 'MAYA' : 'LANGSUNG'
    setMode(newMode)
    await fetch('/api/session-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, slotType, date: dateStr, mode: newMode, groupId })
    }).catch(() => setMode(mode))
  }

  if (loading) return <span className="spinner-border spinner-border-sm text-primary" style={{ width: '12px', height: '12px' }}></span>

  const canToggle = slotType === 'personal' || isAdmin

  return (
    <button 
      onClick={canToggle ? toggleMode : undefined}
      className={`btn btn-sm d-flex align-items-center gap-1 fw-bold border-0 shadow-sm`}
      style={{ 
        cursor: canToggle ? 'pointer' : 'default', 
        fontSize: '11px', 
        padding: '4px 10px',
        borderRadius: '12px',
        background: mode === 'MAYA' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#ffffff',
        transition: 'all 0.2s ease',
        transform: canToggle ? 'translateY(-1px)' : 'none'
      }}
      title={canToggle ? "Klik untuk ubah mode" : "Mode ditetapkan oleh komisaris"}
    >
      <i className={`bi ${mode === 'MAYA' ? 'bi-laptop' : 'bi-person-video3'}`}></i>
      {mode === 'MAYA' ? 'Sesi Daring' : 'Sesi Luring'}
    </button>
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

  // Close dropdown on outside click (simple approach for standalone components by just letting onBlur handle it, or we use a ref)
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

