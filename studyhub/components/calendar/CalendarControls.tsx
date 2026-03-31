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

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    setStatus(newStatus)
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, slotType, date: dateStr, status: newStatus })
    }).catch(() => {})
  }

  if (loading) return null

  // Warna gradasi berdasar status persensi
  const statusColors: Record<string, string> = {
    '': 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    'HADIR': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'TIDAK_HADIR': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    'SAKIT': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'IZIN': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  }
  const statusLabels: Record<string, string> = {
    '': 'Belum Set Presensi',
    'HADIR': 'Hadir',
    'TIDAK_HADIR': 'Absen',
    'SAKIT': 'Sakit',
    'IZIN': 'Izin',
  }

  return (
    <div className="dropdown d-inline-block ms-2">
      <button 
        className="btn btn-sm d-flex align-items-center gap-2 fw-bold shadow-sm" 
        data-bs-toggle="dropdown" 
        style={{
          background: statusColors[status] || statusColors[''],
          color: status ? '#ffffff' : '#334155',
          borderRadius: '12px',
          fontSize: '11px',
          padding: '4px 12px',
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease',
        }}
      >
        <i className={`bi ${status === 'HADIR' ? 'bi-check-circle-fill' : status === 'TIDAK_HADIR' ? 'bi-x-circle-fill' : status === 'SAKIT' ? 'bi-thermometer-half' : status === 'IZIN' ? 'bi-envelope-paper-fill' : 'bi-question-circle'}`}></i>
        {statusLabels[status] || statusLabels['']}
        <i className="bi bi-chevron-down" style={{ fontSize: '9px', opacity: 0.7 }}></i>
      </button>
      <ul className="dropdown-menu dropdown-menu-end shadow border-0" style={{ borderRadius: '16px', overflow: 'hidden', minWidth: '150px' }}>
        <li><button className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px' }} onClick={() => handleStatusChange({ target: { value: 'HADIR' }} as any)}><i className="bi bi-check-circle text-success me-2"></i>Hadir</button></li>
        <li><button className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px' }} onClick={() => handleStatusChange({ target: { value: 'IZIN' }} as any)}><i className="bi bi-envelope-paper text-primary me-2"></i>Izin</button></li>
        <li><button className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px' }} onClick={() => handleStatusChange({ target: { value: 'SAKIT' }} as any)}><i className="bi bi-thermometer text-warning me-2"></i>Sakit</button></li>
        <li><hr className="dropdown-divider m-0" /></li>
        <li><button className="dropdown-item py-2 fw-semibold" style={{ fontSize: '12px' }} onClick={() => handleStatusChange({ target: { value: 'TIDAK_HADIR' }} as any)}><i className="bi bi-x-circle text-danger me-2"></i>Absen (Tidak Hadir)</button></li>
      </ul>
    </div>
  )
}
