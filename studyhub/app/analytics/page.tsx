'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Chart,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, DoughnutController, BarController,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, BarController)

interface DayValue { date: string; value: number }
interface HeatmapDay { date: string; count: number }
interface AnalyticsData {
  user: { points: number; streak: number; createdAt: string } | null
  taskStats: { total: number; done: number; inProgress: number; todo: number; highPriority: number }
  timerByDay: DayValue[]
  timerByDay30: DayValue[]
  heatmap: HeatmapDay[]
  totalFocusSessions: number
  totalFocusMinutes: number
  totalAISessions: number
  totalThreads: number
}

function formatDate(dateStr: string, short = false) {
  const d = new Date(dateStr)
  if (short) return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function StatCard({ icon, label, value, accent, sub }: {
  icon: string; label: string; value: string | number; accent: string; sub?: string
}) {
  return (
    <div className="card p-3 h-100">
      <div className="d-flex align-items-center gap-3">
        <div className="rounded-3 d-flex align-items-center justify-content-center"
          style={{ width: 46, height: 46, background: `${accent}18`, flexShrink: 0 }}>
          <i className={`bi ${icon}`} style={{ fontSize: 20, color: accent }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="fw-bold" style={{ fontSize: 22, color: 'var(--sh-text)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--sh-muted)', marginTop: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: accent, marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7' | '30'>('7')
  const barRef = useRef<HTMLCanvasElement>(null)
  const doughnutRef = useRef<HTMLCanvasElement>(null)
  const barChart = useRef<Chart | null>(null)
  const doughnutChart = useRef<Chart | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!data) return
    const timerData = range === '7' ? data.timerByDay : (data.timerByDay30 ?? data.timerByDay)

    // Bar chart
    if (barRef.current) {
      barChart.current?.destroy()
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: timerData.map(d => formatDate(d.date, true)),
          datasets: [{
            label: 'Menit Fokus',
            data: timerData.map(d => d.value),
            backgroundColor: 'rgba(99,102,241,0.75)',
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} menit` } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => `${v}m`, color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          },
        },
      })
    }

    // Doughnut chart
    if (doughnutRef.current && data.taskStats.total > 0) {
      doughnutChart.current?.destroy()
      doughnutChart.current = new Chart(doughnutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Selesai ✅', 'Sedang Dikerjakan 🔄', 'Belum Mulai 📋'],
          datasets: [{
            data: [data.taskStats.done, data.taskStats.inProgress, data.taskStats.todo],
            backgroundColor: ['#10b981', '#6366f1', '#94a3b8'],
            borderWidth: 2,
            borderColor: 'transparent',
            hoverOffset: 5,
          }],
        },
        options: {
          responsive: true, cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 12 }, padding: 14, color: '#94a3b8' },
            },
          },
        },
      })
    }

    return () => { barChart.current?.destroy(); doughnutChart.current?.destroy() }
  }, [data, range])

  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#6366f1' }} />
    </div>
  )

  if (!data) return (
    <div className="rounded-3 p-4 text-center"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
      Gagal memuat data analitik.
    </div>
  )

  const completionRate = data.taskStats.total > 0
    ? Math.round((data.taskStats.done / data.taskStats.total) * 100) : 0
  const maxHeat = Math.max(1, ...data.heatmap.map(h => h.count))
  const heatColors = [
    'rgba(99,102,241,0.08)',
    'rgba(99,102,241,0.25)',
    'rgba(99,102,241,0.45)',
    'rgba(99,102,241,0.65)',
    'rgba(99,102,241,0.9)',
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: 'var(--sh-text)' }}>
          <i className="bi bi-graph-up-arrow me-2" style={{ color: '#6366f1' }} />
          Analitik Progress
        </h1>
        <p className="mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
          Pantau perjalanan belajarmu
          {data.user?.createdAt && ` · Bergabung ${formatDate(data.user.createdAt)}`}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <StatCard icon="bi-star-fill" label="Total Poin"
            value={(data.user?.points ?? 0).toLocaleString('id-ID')} accent="#f59e0b"
            sub="✨ Kumpulkan lebih banyak!" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-fire" label="Streak"
            value={`${data.user?.streak ?? 0} hari`} accent="#ef4444"
            sub={data.user?.streak ? '🔥 Pertahankan!' : 'Mulai streak hari ini'} />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-alarm-fill" label="Sesi Fokus"
            value={data.totalFocusSessions} accent="#6366f1"
            sub={`${data.totalFocusMinutes} menit total`} />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-check2-circle" label="Tugas Selesai"
            value={`${completionRate}%`} accent="#10b981"
            sub={`${data.taskStats.done} dari ${data.taskStats.total}`} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        {/* Bar Chart */}
        <div className="col-md-8">
          <div className="card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="fw-semibold" style={{ fontSize: 14, color: 'var(--sh-text)' }}>
                <i className="bi bi-alarm me-2" style={{ color: '#6366f1' }} />
                Waktu Fokus (menit)
              </div>
              <div className="btn-group btn-group-sm">
                {(['7', '30'] as const).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className="btn btn-sm"
                    style={{
                      fontSize: 11, borderRadius: 8,
                      background: range === r ? '#6366f1' : 'rgba(99,102,241,0.08)',
                      color: range === r ? 'white' : '#6366f1',
                      border: range === r ? 'none' : '1px solid rgba(99,102,241,0.2)',
                    }}>
                    {r} Hari
                  </button>
                ))}
              </div>
            </div>
            {data.totalFocusSessions === 0 ? (
              <div className="d-flex align-items-center justify-content-center text-center"
                style={{ minHeight: 180 }}>
                <div>
                  <i className="bi bi-alarm" style={{ fontSize: 36, color: 'var(--sh-muted)' }} />
                  <p className="mt-2 mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>
                    Belum ada sesi fokus. Mulai Pomodoro Timer!
                  </p>
                </div>
              </div>
            ) : (
              <canvas ref={barRef} height={180} />
            )}
          </div>
        </div>

        {/* Doughnut */}
        <div className="col-md-4">
          <div className="card p-4 h-100">
            <div className="fw-semibold mb-3" style={{ fontSize: 14, color: 'var(--sh-text)' }}>
              <i className="bi bi-check2-square me-2" style={{ color: '#10b981' }} />
              Status Tugas
            </div>
            {data.taskStats.total === 0 ? (
              <div className="d-flex align-items-center justify-content-center text-center"
                style={{ minHeight: 160 }}>
                <div>
                  <i className="bi bi-list-check" style={{ fontSize: 36, color: 'var(--sh-muted)' }} />
                  <p className="mt-2 mb-0" style={{ fontSize: 13, color: 'var(--sh-muted)' }}>Belum ada tugas</p>
                </div>
              </div>
            ) : (
              <canvas ref={doughnutRef} />
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card p-4 mb-4">
        <div className="fw-semibold mb-3" style={{ fontSize: 14, color: 'var(--sh-text)' }}>
          <i className="bi bi-grid-3x3 me-2" style={{ color: '#6366f1' }} />
          Aktivitas 30 Hari Terakhir
        </div>
        <div className="d-flex flex-wrap gap-1">
          {data.heatmap.map(h => {
            const intensity = h.count === 0 ? 0 : Math.ceil((h.count / maxHeat) * 4)
            return (
              <div key={h.date}
                title={`${formatDate(h.date, true)}: ${h.count} aktivitas`}
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: heatColors[intensity],
                  border: intensity === 0
                    ? '1px solid rgba(99,102,241,0.12)'
                    : '1px solid transparent',
                  cursor: 'default',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.35)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            )
          })}
        </div>
        <div className="d-flex align-items-center gap-1 mt-3">
          <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>Sedikit</span>
          {heatColors.map((c, i) => (
            <div key={i} style={{ width: 13, height: 13, borderRadius: 3, background: c,
              border: i === 0 ? '1px solid rgba(99,102,241,0.15)' : 'none' }} />
          ))}
          <span style={{ fontSize: 11, color: 'var(--sh-muted)' }}>Banyak</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="row g-3">
        <div className="col-sm-4">
          <div className="card p-3 text-center">
            <i className="bi bi-robot mb-1" style={{ fontSize: 24, color: '#6366f1' }} />
            <div className="fw-bold" style={{ fontSize: 20, color: 'var(--sh-text)' }}>{data.totalAISessions}</div>
            <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>Sesi AI Tutor (30 hari)</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card p-3 text-center">
            <i className="bi bi-chat-dots mb-1" style={{ fontSize: 24, color: '#f59e0b' }} />
            <div className="fw-bold" style={{ fontSize: 20, color: 'var(--sh-text)' }}>{data.totalThreads}</div>
            <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>Thread Forum (30 hari)</div>
          </div>
        </div>
        <div className="col-sm-4">
          <div className="card p-3 text-center">
            <i className="bi bi-lightning-charge mb-1" style={{ fontSize: 24, color: '#ef4444' }} />
            <div className="fw-bold" style={{ fontSize: 20, color: 'var(--sh-text)' }}>{data.taskStats.highPriority}</div>
            <div style={{ fontSize: 12, color: 'var(--sh-muted)' }}>Tugas Prioritas Tinggi</div>
          </div>
        </div>
      </div>
    </div>
  )
}
