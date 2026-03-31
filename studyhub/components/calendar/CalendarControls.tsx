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

  if (loading) return <span className="badge bg-secondary opacity-50" style={{ fontSize: '10px' }}>...</span>

  const canToggle = slotType === 'personal' || isAdmin

  return (
    <button 
      onClick={canToggle ? toggleMode : undefined}
      className={`badge border-0 ${mode === 'MAYA' ? 'bg-primary' : 'bg-success'}`}
      style={{ cursor: canToggle ? 'pointer' : 'default', fontSize: '10px', padding: '3px 6px' }}
      title={canToggle ? "Klik untuk ubah mode" : "Mode ditetapkan oleh komisaris"}
    >
      {mode === 'MAYA' ? 'Daring (Maya)' : 'Luring (Langsung)'}
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

  return (
    <select 
      value={status} 
      onChange={handleStatusChange}
      className="form-select form-select-sm d-inline-block border-secondary text-secondary ms-2"
      style={{ fontSize: '10px', height: 'auto', padding: '2px 14px 2px 6px', width: 'auto', backgroundPosition: 'right 4px center' }}
    >
      <option value="" disabled>Presensi?</option>
      <option value="HADIR">Hadir / V</option>
      <option value="TIDAK_HADIR">Absen / X</option>
      <option value="SAKIT">Sakit / S</option>
      <option value="IZIN">Izin / I</option>
    </select>
  )
}
