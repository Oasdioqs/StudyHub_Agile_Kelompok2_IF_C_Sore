'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRemainingBeforeDeadline, formatSlotDurationLabel } from '@/lib/activity-metrics'
import { WEEKDAY_LABELS, mondayFirstIndex } from '@/lib/schedule-week'
import { SessionModeToggle, AttendanceSelect } from '@/components/calendar/CalendarControls'

type CalendarTask = {
  id: string
  title: string
  deadline: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  subject: string | null
}

type ScheduleSlot = {
  id: string
  dayOfWeek: number
  title: string
  startTime: string | null
  endTime: string | null
  place: string | null
  groupId?: string | null
  isAdmin?: boolean
  syncMode?: string
  liveMeetingUrl?: string | null
}

type DaySlot = { title: string; startTime: string; endTime: string; place: string }

function ymdKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function emptySlotsByDay(): Record<number, DaySlot[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
}

function buildSlotsByDay(slots: ScheduleSlot[]): Record<number, DaySlot[]> {
  const out = emptySlotsByDay()
  for (const s of slots) {
    if (s.dayOfWeek < 0 || s.dayOfWeek > 6) continue
    out[s.dayOfWeek].push({
      title: s.title,
      startTime: s.startTime ?? '',
      endTime: s.endTime ?? '',
      place: s.place ?? '',
    })
  }
  return out
}

function sortSlotsByTime(a: ScheduleSlot, b: ScheduleSlot) {
  const ta = a.startTime ?? ''
  const tb = b.startTime ?? ''
  const c = ta.localeCompare(tb)
  if (c !== 0) return c
  return a.title.localeCompare(b.title)
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({})
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [slotsByDay, setSlotsByDay] = useState<Record<number, DaySlot[]>>(() => emptySlotsByDay())
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null)
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' })
      const data = (await res.json().catch(() => [])) as CalendarTask[]
      if (Array.isArray(data)) setTasks(data)
      else setTasks([])
    } catch {
      setTasks([])
    }
  }, [])

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule', { cache: 'no-store', credentials: 'same-origin' })
      if (!res.ok) {
        setScheduleSlots([])
        let msg = 'Gagal memuat jadwal.'
        try {
          const j = (await res.json()) as { error?: string }
          if (typeof j?.error === 'string' && j.error) msg = j.error
        } catch {}
        if (res.status === 401) msg = 'Sesi habis. Silakan login lagi.'
        setScheduleLoadError(msg)
        return
      }
      setScheduleLoadError(null)
      const data = (await res.json().catch(() => [])) as ScheduleSlot[]
      setScheduleSlots(Array.isArray(data) ? data : [])
    } catch {
      setScheduleSlots([])
      setScheduleLoadError('Gagal memuat jadwal (jaringan).')
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadTasks(), loadSchedule()])
    } finally {
      setLoading(false)
    }
  }, [loadTasks, loadSchedule])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const year = monthCursor.getFullYear()
    const loadHolidays = async () => {
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`, {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => [])) as Array<{ date: string; localName?: string; name?: string }>
        if (!Array.isArray(data)) return
        const map: Record<string, string> = {}
        for (const item of data) {
          if (!item?.date) continue
          map[item.date] = item.localName || item.name || 'Hari Libur Nasional'
        }
        setHolidaysByDate((prev) => ({ ...prev, ...map }))
      } catch {
      }
    }
    void loadHolidays()
  }, [monthCursor])

  const scheduleByDay = useMemo(() => {
    const map = new Map<number, ScheduleSlot[]>()
    for (const s of scheduleSlots) {
      if (s.dayOfWeek < 0 || s.dayOfWeek > 6) continue
      const list = map.get(s.dayOfWeek) ?? []
      list.push(s)
      map.set(s.dayOfWeek, list)
    }
    map.forEach((list) => {
      list.sort(sortSlotsByTime)
    })
    return map
  }, [scheduleSlots])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    for (const task of tasks) {
      if (!task.deadline) continue
      const date = new Date(task.deadline)
      if (Number.isNaN(date.getTime())) continue
      const key = ymdKey(date)
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    return map
  }, [tasks])

  const days = useMemo(() => {
    const firstDayOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
    const startWeekDay = firstDayOfMonth.getDay()
    const gridStart = new Date(firstDayOfMonth)
    gridStart.setDate(firstDayOfMonth.getDate() - startWeekDay)

    return Array.from({ length: 42 }).map((_, idx) => {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + idx)
      return day
    })
  }, [monthCursor])

  const selectedTasks = useMemo(() => {
    const key = ymdKey(selectedDate)
    return (tasksByDate.get(key) ?? []).sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : 0
      const bd = b.deadline ? new Date(b.deadline).getTime() : 0
      return ad - bd
    })
  }, [selectedDate, tasksByDate])

  const selectedScheduleSlots = useMemo(() => {
    const mf = mondayFirstIndex(selectedDate)
    return [...(scheduleByDay.get(mf) ?? [])].sort(sortSlotsByTime)
  }, [selectedDate, scheduleByDay])

  const monthLabel = monthCursor.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  const todayKey = ymdKey(new Date())
  const selectedKey = ymdKey(selectedDate)
  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(todayStart)
    weekEnd.setDate(todayStart.getDate() + 7)
    let today = 0
    let week = 0
    let overdue = 0
    for (const t of tasks) {
      if (!t.deadline || t.status === 'DONE') continue
      const d = new Date(t.deadline)
      if (Number.isNaN(d.getTime())) continue
      if (d < now) overdue += 1
      if (ymdKey(d) === todayKey) today += 1
      if (d >= todayStart && d < weekEnd) week += 1
    }
    return { today, week, overdue }
  }, [tasks, todayKey])

  const openScheduleModal = () => {
    setScheduleSaveError(null)
    setSlotsByDay(buildSlotsByDay(scheduleSlots))
    setScheduleModalOpen(true)
  }

  const addSlotRow = (dayIndex: number) => {
    setSlotsByDay((prev) => ({
      ...prev,
      [dayIndex]: [...(prev[dayIndex] ?? []), { title: '', startTime: '', endTime: '', place: '' }],
    }))
  }

  const removeSlotRow = (dayIndex: number, rowIndex: number) => {
    setSlotsByDay((prev) => {
      const copy = [...(prev[dayIndex] ?? [])]
      copy.splice(rowIndex, 1)
      return { ...prev, [dayIndex]: copy }
    })
  }

  const updateSlotRow = (dayIndex: number, rowIndex: number, patch: Partial<DaySlot>) => {
    setSlotsByDay((prev) => {
      const copy = [...(prev[dayIndex] ?? [])]
      const cur = copy[rowIndex]
      if (!cur) return prev
      copy[rowIndex] = { ...cur, ...patch }
      return { ...prev, [dayIndex]: copy }
    })
  }

  const saveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setScheduleSaveError(null)
    setSavingSchedule(true)
    try {
      const slots: { dayOfWeek: number; title: string; startTime: string | null; endTime: string | null; place: string | null }[] = []
      const rowsExist = Object.values(slotsByDay).some((rows) => (rows?.length ?? 0) > 0)
      for (let d = 0; d < 7; d++) {
        for (const row of slotsByDay[d] ?? []) {
          const title = row.title.trim()
          if (!title) continue
          slots.push({
            dayOfWeek: d,
            title,
            startTime: row.startTime.trim() || null,
            endTime: row.endTime.trim() || null,
            place: row.place.trim() || null,
          })
        }
      }
      if (slots.length === 0 && rowsExist) {
        setScheduleSaveError('Isi nama mata kuliah (wajib) pada baris yang ingin disimpan.')
        return
      }
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slots }),
      })
      const raw = await res.json().catch(() => null)
      if (!res.ok) {
        let msg = 'Gagal menyimpan jadwal.'
        if (raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error?: string }).error === 'string') {
          msg = (raw as { error: string }).error
        } else if (res.status === 401) {
          msg = 'Sesi habis. Silakan login lagi.'
        }
        setScheduleSaveError(msg)
        return
      }
      if (!Array.isArray(raw)) {
        setScheduleSaveError('Respons server tidak valid.')
        return
      }
      setScheduleSlots(raw)
      setScheduleModalOpen(false)
    } finally {
      setSavingSchedule(false)
    }
  }

  const agendaEmpty = !loading && selectedTasks.length === 0 && selectedScheduleSlots.length === 0

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <h3 className="mb-1">Kalender Tugas</h3>
          <p className="text-muted mb-0">Pantau deadline tugas, libur nasional, dan jadwal kuliah mingguan.</p>
        </div>
        <div className="calendar-header-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openScheduleModal}>
            <i className="bi bi-calendar-plus me-1"></i>
            Tambah jadwal
          </button>
          <div className="calendar-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <div className="month-pill">{monthLabel}</div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {scheduleLoadError && (
        <div className="alert alert-warning py-2 px-3 mb-0" role="alert">
          <strong>Jadwal:</strong> {scheduleLoadError}
        </div>
      )}

      <div className="stats-row">
        <div className="stats-card">
          <div className="stats-label">Tugas Hari Ini</div>
          <div className="stats-value">{stats.today}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">7 Hari Ke Depan</div>
          <div className="stats-value">{stats.week}</div>
        </div>
        <div className="stats-card danger">
          <div className="stats-label">Overdue</div>
          <div className="stats-value">{stats.overdue}</div>
        </div>
      </div>

      <section className="schedule-summary-card">
        <div className="schedule-summary-head">
          <h6 className="mb-0">Jadwal mingguan (kuliah / sekolah)</h6>
          <span className="schedule-summary-meta">{scheduleSlots.length} entri</span>
        </div>
        <div className="schedule-summary-grid">
          {WEEKDAY_LABELS.map((label, idx) => {
            const slots = scheduleByDay.get(idx) ?? []
            return (
              <div key={label} className={`schedule-summary-day ${slots.length ? 'has-items' : ''}`}>
                <div className="schedule-summary-dow">{label}</div>
                {slots.length === 0 ? (
                  <div className="schedule-summary-empty">—</div>
                ) : (
                  <ul className="schedule-summary-list">
                    {slots.map((s) => {
                      const dur = formatSlotDurationLabel(s.startTime, s.endTime)
                      return (
                      <li key={s.id}>
                        <span className="schedule-summary-title">{s.title}</span>
                        {(s.startTime || s.endTime) && (
                          <span className="schedule-summary-time">
                            {s.startTime ?? '—'} – {s.endTime ?? '—'}
                            {dur && <> · {dur}</>}
                          </span>
                        )}
                      </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <div className="calendar-shell">
        <section className="calendar-grid-card">
          <div className="week-head">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
              <div key={d} className="week-cell">{d}</div>
            ))}
          </div>
          <div className="month-grid">
            {days.map((day) => {
              const key = ymdKey(day)
              const taskCount = (tasksByDate.get(key) ?? []).length
              const mf = mondayFirstIndex(day)
              const scheduleCount = (scheduleByDay.get(mf) ?? []).length
              const totalMark = taskCount + scheduleCount
              const inCurrentMonth = day.getMonth() === monthCursor.getMonth()
              const isToday = key === todayKey
              const isSelected = key === selectedKey
              const holidayName = holidaysByDate[key] || ''
              const isWeekend = day.getDay() === 0
              const isHoliday = Boolean(holidayName) || isWeekend
              return (
                <button
                  key={key}
                  type="button"
                  className={`day-cell ${inCurrentMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isHoliday ? 'holiday' : ''}`}
                  onClick={() => setSelectedDate(startOfDay(day))}
                >
                  <span className="day-num">{day.getDate()}</span>
                  {holidayName && <span className="holiday-label">{holidayName}</span>}
                  {totalMark > 0 && (
                    <span className="day-badges">
                      {scheduleCount > 0 && <span className="schedule-dot" title="Jadwal">{scheduleCount}</span>}
                      {taskCount > 0 && <span className="task-dot" title="Tugas">{taskCount}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section className="agenda-card">
          <div className="agenda-head">
            <h6 className="mb-0">Agenda {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long' })}</h6>
            {holidaysByDate[selectedKey] && (
              <div className="holiday-banner">{holidaysByDate[selectedKey]}</div>
            )}
          </div>
          {loading ? (
            <div className="agenda-loading">
              <div className="agenda-skeleton-line w-75"></div>
              <div className="agenda-skeleton-line w-100"></div>
              <div className="agenda-skeleton-line w-50"></div>
              <div className="agenda-skeleton-line w-90"></div>
            </div>
          ) : agendaEmpty ? (
            <div className="agenda-empty">Belum ada jadwal atau tugas pada tanggal ini.</div>
          ) : (
            <div className="agenda-sections">
              {selectedScheduleSlots.length > 0 && (
                <div className="agenda-block">
                  <div className="agenda-block-title">Jadwal kuliah / sekolah</div>
                  <div className="agenda-list">
                    {selectedScheduleSlots.map((s) => {
                      const dur = formatSlotDurationLabel(s.startTime, s.endTime)
                      return (
                      <div key={s.id} className="agenda-item agenda-schedule">
                        <div className="agenda-title-row">
                          <div className="agenda-title">{s.title}</div>
                          <div className="d-flex align-items-center gap-2">
                            <SessionModeToggle slotId={s.id} slotType={s.groupId ? 'class' : 'personal'} dateStr={selectedKey} groupId={s.groupId ?? undefined} isAdmin={s.isAdmin} />
                            <span className="badge schedule-badge">Jadwal</span>
                          </div>
                        </div>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
                          <div className="agenda-meta m-0 fw-medium" style={{ fontSize: '0.85rem', color: 'var(--sh-text)' }}>
                            {(s.startTime || s.endTime) && (
                              <>
                                <span>
                                  {s.startTime ?? '—'} – {s.endTime ?? '—'}
                                  {dur && <> · {dur}</>}
                                </span>
                                {s.place && (
                                  <>
                                    <span className="dot-sep mx-2">•</span>
                                    <span>{s.place}</span>
                                  </>
                                )}
                              </>
                            )}
                            {!s.startTime && !s.endTime && s.place && <span>{s.place}</span>}
                          </div>
                          <div className="ms-auto flex-shrink-0">
                            <AttendanceSelect slotId={s.id} slotType={s.groupId ? 'class' : 'personal'} dateStr={selectedKey} />
                          </div>
                        </div>
                        {/* Live Meeting Link */}
                        {s.liveMeetingUrl && (
                          <div className="agenda-live-meeting">
                            <a href={s.liveMeetingUrl} target="_blank" rel="noopener noreferrer" className="agenda-live-btn">
                              <i className="bi bi-camera-video-fill"></i> Buka Live Meeting
                            </a>
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedTasks.length > 0 && (
                <div className="agenda-block">
                  <div className="agenda-block-title">Tugas</div>
                  <div className="agenda-list">
                    {selectedTasks.map((task) => {
                      const rem = task.deadline ? formatRemainingBeforeDeadline(task.deadline, task.status) : null
                      return (
                      <div key={task.id} className={`agenda-item priority-${task.priority.toLowerCase()}`}>
                        <div className="agenda-title-row">
                          <div className="agenda-title">{task.title}</div>
                          <span className={`badge status-${task.status.toLowerCase()}`}>
                            {task.status === 'DONE' ? 'Completed' : 'Forthcoming'}
                          </span>
                        </div>
                        <div className="agenda-meta">
                          <span>{task.subject || 'Umum'}</span>
                          <span className="dot-sep">•</span>
                          <span>Prioritas {task.priority}</span>
                          {rem && (
                            <>
                              <span className="dot-sep">•</span>
                              <span>{rem}</span>
                            </>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {scheduleModalOpen && (
        <div
          className="schedule-modal-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="schedule-modal-title"
          onClick={() => setScheduleModalOpen(false)}
        >
          <div className="schedule-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-head">
              <h6 id="schedule-modal-title" className="mb-0">Tambah / edit jadwal mingguan</h6>
              <button type="button" className="btn btn-sm btn-light" onClick={() => setScheduleModalOpen(false)} aria-label="Tutup">
                ×
              </button>
            </div>
            <p className="schedule-modal-desc text-muted small">
              Per hari bisa beberapa mapel: pakai tombol &quot;+ Mapel&quot;. Baris tanpa judul diabaikan saat simpan. Jadwal tampil di ringkasan, kalender, dan dashboard (hari ini · WIB).
            </p>
            {scheduleSaveError && (
              <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                {scheduleSaveError}
              </div>
            )}
            <form onSubmit={saveSchedule}>
              <div className="schedule-day-rows">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <div key={label} className="schedule-day-block">
                    <div className="schedule-day-block-head">
                      <span className="schedule-day-label">{label}</span>
                      <button type="button" className="btn btn-outline-primary btn-sm py-0 px-2" onClick={() => addSlotRow(idx)}>
                        + Mapel
                      </button>
                    </div>
                    {(slotsByDay[idx] ?? []).length === 0 ? (
                      <p className="schedule-day-empty text-muted small mb-0">Belum ada jadwal — klik + Mapel</p>
                    ) : (
                      (slotsByDay[idx] ?? []).map((row, ridx) => {
                        const slotDur = formatSlotDurationLabel(row.startTime, row.endTime)
                        return (
                        <div key={`${idx}-${ridx}`} className="schedule-slot-card">
                          <div className="schedule-slot-card-top">
                            <span className="schedule-slot-num">{ridx + 1}</span>
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0 schedule-slot-remove"
                              onClick={() => removeSlotRow(idx, ridx)}
                              aria-label={`Hapus mapel ${ridx + 1} ${label}`}
                            >
                              Hapus
                            </button>
                          </div>
                          <input
                            type="text"
                            className="form-control form-control-sm mb-2"
                            placeholder="Mata kuliah / mapel"
                            value={row.title}
                            onChange={(e) => updateSlotRow(idx, ridx, { title: e.target.value })}
                          />
                          <div className="schedule-time-row">
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              aria-label={`Mulai ${label} ${ridx + 1}`}
                              value={row.startTime}
                              onChange={(e) => updateSlotRow(idx, ridx, { startTime: e.target.value })}
                            />
                            <span className="schedule-time-sep">–</span>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              aria-label={`Selesai ${label} ${ridx + 1}`}
                              value={row.endTime}
                              onChange={(e) => updateSlotRow(idx, ridx, { endTime: e.target.value })}
                            />
                            <input
                              type="text"
                              className="form-control form-control-sm schedule-place"
                              placeholder="Ruang (opsional)"
                              value={row.place}
                              onChange={(e) => updateSlotRow(idx, ridx, { place: e.target.value })}
                            />
                          </div>
                          {slotDur && (
                            <div className="small mb-0 mt-1" style={{ fontSize: 11 }}>
                              {slotDur}
                            </div>
                          )}
                        </div>
                        )
                      })
                    )}
                  </div>
                ))}
              </div>
              <div className="schedule-modal-actions">
                <button type="button" className="btn btn-light" onClick={() => setScheduleModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSchedule}>
                  {savingSchedule ? 'Menyimpan…' : 'Simpan jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-page { display: flex; flex-direction: column; gap: 14px; }
        .calendar-header p {
          color: color-mix(in srgb, var(--sh-text) 80%, transparent) !important;
        }
        .calendar-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
        .calendar-header-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .stats-card {
          border: 1px solid var(--sh-border);
          background: linear-gradient(135deg, color-mix(in srgb, var(--sh-card-bg) 82%, #6366f1 18%), var(--sh-card-bg));
          border-radius: 14px;
          padding: 12px;
        }
        .stats-card.danger {
          background: linear-gradient(135deg, color-mix(in srgb, var(--sh-card-bg) 84%, #ef4444 16%), var(--sh-card-bg));
        }
        .stats-label { color: var(--sh-muted); font-size: 12px; font-weight: 600; }
        .stats-value { color: var(--sh-text); font-size: 24px; font-weight: 800; line-height: 1.1; margin-top: 2px; }
        .calendar-actions { display: flex; align-items: center; gap: 8px; }
        .month-pill {
          min-width: 170px;
          text-align: center;
          border: 1px solid var(--sh-border);
          background: var(--sh-card-bg);
          color: var(--sh-text);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 700;
        }
        .schedule-summary-card {
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 16px;
          padding: 14px;
        }
        .schedule-summary-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 8px;
        }
        .schedule-summary-head h6 { font-weight: 800; font-size: 14px; color: var(--sh-text); }
        .schedule-summary-meta { font-size: 11px; color: var(--sh-muted); font-weight: 600; }
        .schedule-summary-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }
        .schedule-summary-day {
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          padding: 8px;
          min-height: 72px;
          background: color-mix(in srgb, var(--sh-card-bg) 94%, #64748b 6%);
        }
        .schedule-summary-day.has-items {
          border-color: #6366f1;
          background: color-mix(in srgb, var(--sh-card-bg) 88%, #6366f1 12%);
        }
        .schedule-summary-dow {
          font-size: 10px;
          font-weight: 800;
          color: var(--sh-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }
        .schedule-summary-empty { font-size: 12px; color: var(--sh-muted); }
        .schedule-summary-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .schedule-summary-list li { font-size: 11px; color: var(--sh-text); line-height: 1.35; }
        .schedule-summary-title { font-weight: 700; display: block; }
        .schedule-summary-time { font-size: 10px; color: var(--sh-muted); display: block; margin-top: 2px; }
        .calendar-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 14px;
        }
        .calendar-grid-card {
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 16px;
          overflow: hidden;
        }
        .agenda-card {
          background: var(--sh-card-bg);
          border: 1px solid var(--sh-border);
          border-radius: 16px;
          overflow: visible;
        }
        .week-head {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: color-mix(in srgb, var(--sh-card-bg) 85%, #4f46e5 15%);
          border-bottom: 1px solid var(--sh-border);
        }
        .week-cell {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          padding: 10px 4px;
          color: var(--sh-muted);
        }
        .month-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: var(--sh-border);
        }
        .day-cell {
          border: 0;
          background: var(--sh-card-bg);
          min-height: 88px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          color: var(--sh-text);
          position: relative;
        }
        .day-cell.muted { opacity: 0.5; }
        .day-cell.today { box-shadow: inset 0 0 0 2px #6366f1; }
        .day-cell.selected { background: color-mix(in srgb, var(--sh-card-bg) 80%, #6366f1 20%); }
        .day-cell.holiday:not(.selected) {
          background: color-mix(in srgb, var(--sh-card-bg) 88%, #ef4444 12%);
        }
        .day-cell.holiday .day-num {
          color: #dc2626;
        }
        .day-num { font-size: 13px; font-weight: 700; }
        .holiday-label {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: 8px;
          font-size: 9px;
          line-height: 1.2;
          text-align: left;
          color: #b91c1c;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 700;
        }
        .day-badges {
          align-self: flex-end;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: flex-end;
          max-width: 100%;
        }
        .task-dot {
          background: #4f46e5;
          color: #fff;
          border-radius: 999px;
          min-width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          padding: 0 6px;
        }
        .schedule-dot {
          background: #0d9488;
          color: #fff;
          border-radius: 999px;
          min-width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          padding: 0 6px;
        }
        .agenda-head { padding: 14px 14px 10px; border-bottom: 1px solid var(--sh-border); }
        .holiday-banner {
          margin-top: 6px;
          display: inline-flex;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 3px 9px;
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        .agenda-empty { padding: 18px 14px; color: var(--sh-muted); font-size: 13px; }
        .agenda-loading {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .agenda-skeleton-line {
          height: 11px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(148,163,184,0.15), rgba(148,163,184,0.35), rgba(148,163,184,0.15));
          background-size: 220% 100%;
          animation: skeletonShimmer 1.2s ease-in-out infinite;
        }
        .agenda-sections { padding: 10px; display: flex; flex-direction: column; gap: 14px; }
        .agenda-block-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--sh-muted);
          margin-bottom: 8px;
        }
        .agenda-list { display: flex; flex-direction: column; gap: 8px; }
        .agenda-item {
          border: 1px solid var(--sh-border);
          border-left-width: 4px;
          border-radius: 12px;
          padding: 10px;
          background: color-mix(in srgb, var(--sh-card-bg) 92%, #64748b 8%);
        }
        .agenda-item.agenda-schedule {
          border-left-color: #0d9488;
          background: color-mix(in srgb, var(--sh-card-bg) 90%, #0d9488 10%);
        }
        .agenda-item.priority-high { border-left-color: #ef4444; }
        .agenda-item.priority-medium { border-left-color: #f59e0b; }
        .agenda-item.priority-low { border-left-color: #10b981; }
        .agenda-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .agenda-title { font-size: 13px; font-weight: 700; color: var(--sh-text); }
        .agenda-meta { margin-top: 6px; color: var(--sh-muted); font-size: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .dot-sep { opacity: 0.7; }
        .badge { font-size: 10px; border-radius: 999px; padding: 4px 8px; text-transform: uppercase; }
        .schedule-badge { background: #ccfbf1; color: #0f766e; }
        .maya-badge { background: #eef2ff; color: #4338ca; }
        .status-todo { background: #e2e8f0; color: #334155; }
        .status-done { background: #dcfce7; color: #166534; }
        .agenda-live-meeting {
          margin-top: 8px;
          border-top: 1px dashed rgba(13, 148, 136, 0.25);
          padding-top: 8px;
        }
        .agenda-live-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .agenda-live-btn:hover { opacity: 0.88; color: white; transform: translateY(-1px); }
        .schedule-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          z-index: 1080;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .schedule-modal-panel {
          width: min(560px, 100%);
          max-height: min(92vh, 720px);
          overflow: auto;
          background: var(--sh-card-bg);
          padding: 14px 16px 16px;
          border-radius: 16px;
          border: 1px solid var(--sh-border);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
        }
        .schedule-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .schedule-modal-head h6 { font-weight: 800; color: var(--sh-text); }
        .schedule-modal-desc { margin-bottom: 12px; }
        .schedule-day-rows { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
        .schedule-day-block {
          border: 1px solid var(--sh-border);
          border-radius: 12px;
          padding: 10px 12px;
          background: color-mix(in srgb, var(--sh-card-bg) 94%, #64748b 6%);
        }
        .schedule-day-block-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .schedule-day-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--sh-text);
        }
        .schedule-day-empty { font-size: 12px; padding: 4px 0 2px; }
        .schedule-slot-card {
          border: 1px solid var(--sh-border);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 8px;
          background: var(--sh-card-bg);
        }
        .schedule-slot-card:last-child { margin-bottom: 0; }
        .schedule-slot-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .schedule-slot-num {
          font-size: 10px;
          font-weight: 800;
          color: var(--sh-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .schedule-slot-remove { font-size: 11px !important; text-decoration: none !important; }
        .schedule-time-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .schedule-time-row .form-control[type="time"] {
          max-width: 120px;
        }
        .schedule-place { flex: 1; min-width: 140px; }
        .schedule-time-sep { color: var(--sh-muted); font-weight: 700; }
        .schedule-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 4px;
        }
        @media (max-width: 992px) {
          .stats-row { grid-template-columns: 1fr; }
          .calendar-shell { grid-template-columns: 1fr; }
          .schedule-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 768px) {
          .day-cell {
            min-height: 72px;
            padding: 6px;
          }
          .holiday-label {
            font-size: 8px;
            left: 6px;
            right: 6px;
            bottom: 6px;
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
