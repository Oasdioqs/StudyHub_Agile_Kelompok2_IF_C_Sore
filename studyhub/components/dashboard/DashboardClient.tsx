'use client'

// components/dashboard/DashboardClient.tsx
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LiftCard, QuickLinkCard, TaskItem, NoteCard } from './HoverCard'
import { useDashboardStream, DashboardStats } from '@/hooks/useDashboardStream'

// ─── Animated number ───────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 700) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const from  = prevRef.current
    const start = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (target - from) * ease))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return display
}

// ─── Animated progress bar ─────────────────────────────────────────────────
function AnimatedProgressBar({ value }: { value: number }) {
  const [width, setWidth]     = useState(0)
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    const from  = prevRef.current
    const start = performance.now()
    const dur   = 900
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t    = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      const curr = from + (value - from) * ease
      setWidth(curr)
      setDisplay(Math.round(curr))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = value
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>
        <span>Progress harian</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, borderRadius: 999, background: 'linear-gradient(90deg,#6c63ff,#10b981)' }} />
      </div>
    </div>
  )
}

// ─── Live status badge ─────────────────────────────────────────────────────
function LiveBadge({ status }: { status: 'connecting' | 'live' | 'reconnecting' | 'offline' }) {
  const config = {
    connecting:   { dot: '#94a3b8', label: 'Menghubungkan…', pulse: false },
    live:         { dot: '#10b981', label: 'Live',            pulse: true  },
    reconnecting: { dot: '#f59e0b', label: 'Reconnecting…',  pulse: true  },
    offline:      { dot: '#ef4444', label: 'Offline',         pulse: false },
  }[status]

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 999, padding: '4px 12px', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
      <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
        {config.pulse && (
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: config.dot, opacity: 0.6, animation: 'ping 1.4s ease-out infinite' }} />
        )}
        <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: config.dot, display: 'inline-block' }} />
      </span>
      {config.label}
      <style>{`@keyframes ping{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}`}</style>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, emoji, bg, color }: { label: string; value: number; emoji: string; bg: string; color: string }) {
  const animated = useAnimatedNumber(value)
  return (
    <LiftCard style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(0,0,0,0.06)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>
        {emoji}
      </div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700, color, lineHeight: 1, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>
        {animated}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
    </LiftCard>
  )
}

// ─── Priority config ───────────────────────────────────────────────────────
const priorityConfig = {
  HIGH:   { dot: '#ef4444', bg: '#fee2e2', text: '#b91c1c', label: 'Tinggi' },
  MEDIUM: { dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', label: 'Sedang' },
  LOW:    { dot: '#10b981', bg: '#d1fae5', text: '#065f46', label: 'Rendah' },
} as const

// ─── Main ──────────────────────────────────────────────────────────────────
export default function DashboardClient({
  initial,
  firstName,
  today,
}: {
  initial: DashboardStats
  firstName: string
  today: string
}) {
  const { stats, status } = useDashboardStream(initial)
  const { todayTasks, doneToday, totalToday, progress, upcomingCount, recentNotes, unreadNotifs } = stats

  const heroMessage =
    progress === 100 ? 'Mantap, semua beres! 🎉' :
    progress >= 50   ? 'Hampir sampai!' :
    'Yuk semangat!'

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 48px' }}>

      {/* ─── HERO ─────────────────────────────────────────── */}
      <div style={{ background: '#1a1a2e', borderRadius: 20, padding: '28px 28px 24px', position: 'relative', overflow: 'hidden', marginBottom: 20, color: '#fff' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,99,255,0.35),transparent)', top: -80, right: -40, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,0.2),transparent)', bottom: -60, right: 60, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <LiveBadge status={status} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{today}</span>
          </div>

          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>
            Halo, {firstName}! 👋
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
            {doneToday}/{totalToday} tugas selesai hari ini. {heroMessage}
          </p>

          <AnimatedProgressBar value={progress} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/tasks?action=new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1a1a2e', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              ＋ Tambah Tugas
            </Link>
            <Link href="/notes?action=new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '0.5px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              📓 Buat Catatan
            </Link>
            <Link href="/timer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '0.5px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              ⏱ Mulai Timer
            </Link>
          </div>
        </div>
      </div>

      {/* ─── STATS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Tugas Hari Ini"  value={todayTasks.length} emoji="📋" bg="#ede9fe" color="#6c63ff" />
        <StatCard label="Total Aktif"     value={upcomingCount}      emoji="📌" bg="#e0f2fe" color="#0ea5e9" />
        <StatCard label="Catatan"         value={recentNotes.length} emoji="📒" bg="#dcfce7" color="#10b981" />
        <StatCard label="Notifikasi Baru" value={unreadNotifs}       emoji="🔔" bg="#fef9c3" color="#d97706" />
      </div>

      {/* ─── TASKS + NOTES ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

        {/* TASKS */}
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✅</span>
              Tugas Hari Ini
            </div>
            <Link href="/tasks" style={{ fontSize: 11, color: '#6c63ff', textDecoration: 'none', padding: '4px 10px', border: '0.5px solid #c4bfff', borderRadius: 8 }}>
              Lihat Semua
            </Link>
          </div>

          {todayTasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Semua beres hari ini!</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Nice, kamu lagi ahead 🚀</p>
            </div>
          ) : (
            <ul style={{ padding: 0, margin: 0 }}>
              {todayTasks.map((task) => {
                const pc = priorityConfig[task.priority] ?? priorityConfig.LOW
                return (
                  <TaskItem
                    key={task.id}
                    title={task.title}
                    subject={task.subject}
                    dot={pc.dot}
                    badgeBg={pc.bg}
                    badgeText={pc.text}
                    badgeLabel={pc.label}
                  />
                )
              })}
            </ul>
          )}
        </div>

        {/* NOTES */}
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📒</span>
              Catatan Terbaru
            </div>
            <Link href="/notes" style={{ fontSize: 11, color: '#10b981', textDecoration: 'none', padding: '4px 10px', border: '0.5px solid #a7f3d0', borderRadius: 8 }}>
              Lihat Semua
            </Link>
          </div>

          {recentNotes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📝</div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Belum ada catatan</p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Mulai nulis, ide kamu worth it ✨</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12 }}>
              {recentNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  id={note.id}
                  title={note.title}
                  preview={note.content.replace(/[#*`]/g, '').slice(0, 80)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── QUICK LINKS ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {([
          { href: '/forum',    emoji: '💬', label: 'Forum Diskusi',  desc: 'Tanya & jawab bersama', iconBg: '#fef9c3' },
          { href: '/ai-tutor', emoji: '🤖', label: 'AI Tutor',       desc: 'Tanya soal ke AI',      iconBg: '#ede9fe' },
          { href: '/timer',    emoji: '⏱',  label: 'Pomodoro Timer', desc: 'Mulai sesi belajar',    iconBg: '#dcfce7' },
        ] as const).map((item) => (
          <QuickLinkCard key={item.href} {...item} />
        ))}
      </div>

    </main>
  )
}