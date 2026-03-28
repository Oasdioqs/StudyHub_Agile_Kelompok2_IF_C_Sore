'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

type Mode = 'pomodoro' | 'short' | 'long'

const MODES: Record<Mode, { label: string; seconds: number; color: string }> = {
  pomodoro: { label: 'Fokus', seconds: 25 * 60, color: '#4f46e5' },
  short:    { label: 'Istirahat Pendek', seconds: 5 * 60, color: '#10b981' },
  long:     { label: 'Istirahat Panjang', seconds: 15 * 60, color: '#0ea5e9' },
}

export default function TimerPage() {
  const [mode, setMode] = useState<Mode>('pomodoro')
  const [timeLeft, setTimeLeft] = useState(MODES.pomodoro.seconds)
  const [running, setRunning] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [sessions, setSessions] = useState(0)
  const [history, setHistory] = useState<any[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const totalSeconds = MODES[mode].seconds
  const progress = ((totalSeconds - timeLeft) / totalSeconds) * 100
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')

  useEffect(() => {
    fetchHistory()
    document.title = running ? `${mins}:${secs} — StudyHub Timer` : 'Pomodoro Timer — StudyHub'
  }, [running, timeLeft])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            handleComplete()
            return 0
          }
          return t - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const handleComplete = async () => {
    try {
      await axios.post('/api/timer', {
        duration: totalSeconds,
        type: mode,
        taskTitle: taskTitle || null,
      })
      if (mode === 'pomodoro') setSessions(s => s + 1)
      fetchHistory()
      if (Notification.permission === 'granted') {
        new Notification('StudyHub Timer', {
          body: mode === 'pomodoro' ? '✅ Sesi fokus selesai! Waktunya istirahat.' : '⏰ Istirahat selesai! Ayo kembali fokus.',
          icon: '/icons/favicon.ico',
        })
      }
    } catch {}
  }

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get('/api/timer?days=7')
      setHistory(data.sessions ?? [])
    } catch {}
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setTimeLeft(MODES[m].seconds)
    setRunning(false)
  }

  const reset = () => {
    setRunning(false)
    setTimeLeft(MODES[mode].seconds)
  }

  const requestNotifPerm = () => {
    if ('Notification' in window) Notification.requestPermission()
  }

  const circumference = 2 * Math.PI * 88
  const dashOffset = circumference * (1 - progress / 100)

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4">
          <div className="row g-4 justify-content-center">
            <div className="col-12 col-lg-5">
              
              <div className="card mb-4">
                <div className="card-body p-2">
                  <div className="btn-group w-100">
                    {(Object.keys(MODES) as Mode[]).map(m => (
                      <button
                        key={m}
                        className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => switchMode(m)}
                        style={{ fontSize: 13 }}>
                        {MODES[m].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              
              <div className="card mb-4">
                <div className="card-body py-5 text-center">
                  <div style={{ position: 'relative', width: 200, margin: '0 auto 24px' }}>
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="88" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                      <circle
                        cx="100" cy="100" r="88" fill="none"
                        stroke={MODES[mode].color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 100 100)"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                      <div className="fw-bold" style={{ fontSize: 42, color: '#1e293b', lineHeight: 1 }}>
                        {mins}:{secs}
                      </div>
                      <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {MODES[mode].label}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <input
                      className="form-control text-center"
                      placeholder="Sedang mengerjakan apa? (opsional)"
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      style={{ fontSize: 14, border: 'none', borderBottom: '1px solid #e2e8f0', borderRadius: 0 }}
                    />
                  </div>

                  <div className="d-flex gap-2 justify-content-center">
                    <button className="btn btn-outline-secondary" onClick={reset} title="Reset">
                      <i className="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button
                      className={`btn btn-lg px-5 fw-semibold ${running ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => {
                        requestNotifPerm()
                        setRunning(r => !r)
                      }}>
                      {running ? <><i className="bi bi-pause-fill me-2"></i>Pause</> : <><i className="bi bi-play-fill me-2"></i>Mulai</>}
                    </button>
                  </div>
                </div>
              </div>

              
              <div className="card">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold text-muted small">Sesi hari ini</span>
                    <div className="d-flex gap-1">
                      {Array.from({ length: Math.max(4, sessions) }).map((_, i) => (
                        <div key={i} className="rounded-circle"
                          style={{ width: 14, height: 14, background: i < sessions ? '#4f46e5' : '#e2e8f0' }}>
                        </div>
                      ))}
                    </div>
                    <span className="fw-bold">{sessions} sesi</span>
                  </div>
                </div>
              </div>
            </div>

            
            <div className="col-12 col-lg-5">
              <div className="card h-100">
                <div className="card-header bg-white border-bottom py-3">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-clock-history me-2 text-primary"></i>
                    Riwayat 7 Hari Terakhir
                  </h6>
                </div>
                <div className="card-body p-0" style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {history.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-alarm" style={{ fontSize: 36 }}></i>
                      <p className="mt-2 small">Belum ada riwayat sesi</p>
                    </div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {history.map((s: any) => (
                        <li key={s.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                          <div>
                            <div className="fw-semibold" style={{ fontSize: 13 }}>
                              {s.taskTitle ?? (s.type === 'pomodoro' ? 'Sesi Fokus' : 'Istirahat')}
                            </div>
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {new Date(s.completedAt).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <span className={`badge rounded-pill ${s.type === 'pomodoro' ? 'bg-primary bg-opacity-10 text-primary' : 'bg-success bg-opacity-10 text-success'}`}
                            style={{ fontSize: 12 }}>
                            {Math.floor(s.duration / 60)} mnt
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
