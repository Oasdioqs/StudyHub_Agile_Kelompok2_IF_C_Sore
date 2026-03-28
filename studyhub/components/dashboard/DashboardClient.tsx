'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import { LiftCard, QuickLinkCard, TaskItem, NoteCard } from './HoverCard'
import { useDashboardStream, DashboardStats } from '@/hooks/useDashboardStream'
import { formatDurationMinutes } from '@/lib/activity-metrics'
import { WEEKDAY_LABELS } from '@/lib/schedule-week'
import { getJakartaMondayFirstIndex } from '@/lib/jakarta-time'

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

function AnimatedProgressBar({ value, status }: { value: number; status: 'connecting' | 'live' | 'reconnecting' | 'offline' }) {
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
      <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${width}%`, borderRadius: 999, background: 'linear-gradient(90deg,#6c63ff,#10b981)', transition: 'width .25s linear' }} />
        {status === 'live' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.35) 50%, transparent 80%)',
              animation: 'barLiveSweep 1.8s linear infinite',
            }}
          />
        )}
      </div>
      <style>{`@keyframes barLiveSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  )
}

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

type StatTone = 'violet' | 'blue' | 'green' | 'red' | 'amber'

function StatCard({
  label,
  value,
  emoji,
  bg,
  color,
  tone,
  labelColor,
}: {
  label: string
  value: number
  emoji: string
  bg: string
  color: string
  tone: StatTone
  labelColor?: string
}) {
  const animated = useAnimatedNumber(value)
  const toneConfig = {
    violet: { cardBg: 'linear-gradient(160deg,#ffffff,#f6f4ff)', border: '#ddd6fe', glow: 'rgba(124,58,237,0.14)' },
    blue:   { cardBg: 'linear-gradient(160deg,#ffffff,#f0f9ff)', border: '#bae6fd', glow: 'rgba(14,165,233,0.14)' },
    green:  { cardBg: 'linear-gradient(160deg,#ffffff,#f0fdf4)', border: '#bbf7d0', glow: 'rgba(22,163,74,0.14)' },
    red:    { cardBg: 'linear-gradient(160deg,#ffffff,#fff1f2)', border: '#fecdd3', glow: 'rgba(220,38,38,0.14)' },
    amber:  { cardBg: 'linear-gradient(160deg,#ffffff,#fffbeb)', border: '#fde68a', glow: 'rgba(217,119,6,0.14)' },
  }[tone]

  return (
    <LiftCard style={{ background: toneConfig.cardBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${toneConfig.border}`, position: 'relative', overflow: 'hidden', boxShadow: `0 10px 22px ${toneConfig.glow}` }}>
      <div style={{ position: 'absolute', top: -28, right: -20, width: 86, height: 86, borderRadius: '50%', background: `radial-gradient(circle, ${toneConfig.glow}, transparent 68%)`, pointerEvents: 'none' }} />
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10, position: 'relative', zIndex: 1 }}>
        {emoji}
      </div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700, color, lineHeight: 1, marginBottom: 3, fontVariantNumeric: 'tabular-nums', position: 'relative', zIndex: 1 }}>
        {animated}
      </div>
      <div style={{ fontSize: 11, color: labelColor ?? '#64748b', position: 'relative', zIndex: 1 }}>{label}</div>
    </LiftCard>
  )
}

const priorityConfig = {
  HIGH:   { dot: '#ef4444', bg: '#fee2e2', text: '#b91c1c', label: 'Tinggi' },
  MEDIUM: { dot: '#f59e0b', bg: '#fef3c7', text: '#92400e', label: 'Sedang' },
  LOW:    { dot: '#10b981', bg: '#d1fae5', text: '#065f46', label: 'Rendah' },
} as const

export default function DashboardClient({
  initial,
  firstName,
  today,
}: {
  initial: DashboardStats
  firstName: string
  today: string
}) {
  const { stats, status, lastUpdatedAt } = useDashboardStream(initial)
  const {
    todayTasks,
    upcomingTasks,
    doneToday,
    totalToday,
    doneOverall,
    totalOverall,
    todayPending,
    upcomingDue,
    missedDeadlineCount,
    progressPenaltyPercent,
    progress,
    overdueCount,
    recentNotes,
    latestNotifs,
    unreadNotifs,
    history,
    todaySchedule,
    activityMetrics,
  } = stats
  const scheduleWeekdayLabel = WEEKDAY_LABELS[getJakartaMondayFirstIndex()]
  const [liveAgeSec, setLiveAgeSec] = useState(0)
  const [activeNotifId, setActiveNotifId] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({})
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeMinutes, setChallengeMinutes] = useState('25')
  const [challengeSummary, setChallengeSummary] = useState('')
  const [taskActionLoading, setTaskActionLoading] = useState(false)
  const [challengeTick, setChallengeTick] = useState(Date.now())
  const [activeChallenge, setActiveChallenge] = useState<{ startedAt: number; targetMinutes: number } | null>(null)
  const [challengeMap, setChallengeMap] = useState<Record<string, { startedAt: number; targetMinutes: number }>>({})
  const [isDark, setIsDark] = useState(false)
  const [scheduleInfoOpen, setScheduleInfoOpen] = useState(false)

  const dm = {
    muted: isDark ? '#cbd5e1' : '#64748b',
    muted2: isDark ? '#a8b4c8' : '#94a3b8',
    sub: isDark ? '#e2e8f0' : '#6b7280',
    ink: isDark ? '#f1f5f9' : '#1f2937',
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveAgeSec(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastUpdatedAt])

  useEffect(() => {
    setChallengeOpen(false)
    setChallengeSummary('')
  }, [activeTaskId])

  useEffect(() => {
    const timer = setInterval(() => setChallengeTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const map: Record<string, { startedAt: number; targetMinutes: number }> = {}
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('studyhub_task_challenge_')) continue
      const taskId = key.replace('studyhub_task_challenge_', '')
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        map[taskId] = JSON.parse(raw)
      } catch {}
    }
    setChallengeMap(map)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const applyTheme = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    applyTheme()
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const effectiveDone = doneOverall
  const effectiveTotal = totalOverall
  const statusOrder: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, DONE: 2 }
  const mergedTodayTasks = todayTasks.map((t) => ({
    ...t,
    status: (statusOverrides[t.id] as typeof t.status) ?? t.status,
  }))
  const sortedTodayTasks = [...mergedTodayTasks].sort((a, b) => {
    const byStatus = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (byStatus !== 0) return byStatus
    const ad = a.deadline ? new Date(a.deadline as string).getTime() : Number.POSITIVE_INFINITY
    const bd = b.deadline ? new Date(b.deadline as string).getTime() : Number.POSITIVE_INFINITY
    if (ad !== bd) return ad - bd
    const ac = a.createdAt ? new Date(a.createdAt as string).getTime() : 0
    const bc = b.createdAt ? new Date(b.createdAt as string).getTime() : 0
    return bc - ac
  })
  const heroMessage =
    progress === 100 ? 'Mantap semua beres! 🎉' :
    progress >= 50   ? 'Hampir sampai!' :
    'Yuk semangat!'
  const notificationTone = (type: string) => {
    if (type === 'TASK_COMPLETED') return { badge: '✨', bg: '#ecfdf5', dot: '#10b981' }
    if (type === 'TASK_COMPLETED_LATE') return { badge: '⚠️', bg: '#fff7ed', dot: '#f97316' }
    if (type === 'TASK_CREATED') return { badge: '📝', bg: '#eef2ff', dot: '#6366f1' }
    if (type === 'schedule_reminder') return { badge: '📅', bg: '#e0f2fe', dot: '#0284c7' }
    if (type === 'task_deadline_reminder') return { badge: '⏳', bg: '#fef3c7', dot: '#d97706' }
    return { badge: '•', bg: '#f8fafc', dot: '#64748b' }
  }
  const activeNotif = latestNotifs.find((n) => n.id === activeNotifId) ?? null
  const activeTask = sortedTodayTasks.find((t) => t.id === activeTaskId) ?? null
  const activeTaskStatus = activeTask?.status ?? 'TODO'
  const visibleUnreadNotifs = latestNotifs.filter((n) => !n.isRead).length

  const getChallengeKey = (taskId: string) => `studyhub_task_challenge_${taskId}`
  const formatClock = (totalSec: number) => {
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0')
    const ss = (totalSec % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
  }
  const challengeTargetSec = activeChallenge ? activeChallenge.targetMinutes * 60 : 0
  const challengeElapsedSec = activeChallenge ? Math.max(0, Math.floor((challengeTick - activeChallenge.startedAt) / 1000)) : 0
  const challengeRemainingSec = Math.max(0, challengeTargetSec - challengeElapsedSec)

  useEffect(() => {
    if (!activeTaskId) {
      setActiveChallenge(null)
      return
    }
    const raw = localStorage.getItem(getChallengeKey(activeTaskId))
    if (!raw) {
      setActiveChallenge(null)
      return
    }
    try {
      setActiveChallenge(JSON.parse(raw))
    } catch {
      setActiveChallenge(null)
    }
  }, [activeTaskId, activeTaskStatus])

  const startTaskChallenge = async () => {
    if (!activeTask || taskActionLoading) return
    const mins = Number(challengeMinutes)
    if (!Number.isFinite(mins) || mins <= 0) return
    const nowMs = Date.now()
    const challenge = { startedAt: nowMs, targetMinutes: Math.round(mins) }
    setTaskActionLoading(true)
    try {
      localStorage.setItem(getChallengeKey(activeTask.id), JSON.stringify(challenge))
      setChallengeMap((prev) => ({ ...prev, [activeTask.id]: challenge }))
      await axios.patch(`/api/tasks/${activeTask.id}`, { status: 'IN_PROGRESS' })
      setStatusOverrides((prev) => ({ ...prev, [activeTask.id]: 'IN_PROGRESS' }))
      setActiveChallenge(challenge)
      setChallengeOpen(false)
      setChallengeSummary(`Challenge aktif: target ${challenge.targetMinutes} menit. Semangat!`)
    } finally {
      setTaskActionLoading(false)
    }
  }

  const completeTaskNow = async () => {
    if (!activeTask || taskActionLoading) return
    setTaskActionLoading(true)
    try {
      const raw = localStorage.getItem(getChallengeKey(activeTask.id))
      let summary = 'Tugas ditandai selesai.'
      if (raw) {
        const parsed = JSON.parse(raw) as { startedAt: number; targetMinutes: number }
        const elapsedMin = Math.max(1, Math.round((Date.now() - parsed.startedAt) / 60000))
        summary =
          elapsedMin <= parsed.targetMinutes
            ? `Waktu Selesai: ${elapsedMin} menit. Keren! Target ${parsed.targetMinutes} menit tercapai.`
            : `Waktu Selesai: ${elapsedMin} menit. Target ${parsed.targetMinutes} menit belum tercapai, tapi progress tetap bagus!`
        localStorage.removeItem(getChallengeKey(activeTask.id))
        setChallengeMap((prev) => {
          const next = { ...prev }
          delete next[activeTask.id]
          return next
        })
      }
      await axios.patch(`/api/tasks/${activeTask.id}`, { status: 'DONE' })
      setStatusOverrides((prev) => ({ ...prev, [activeTask.id]: 'DONE' }))
      setActiveChallenge(null)
      setChallengeOpen(false)
      setChallengeSummary(summary)
    } finally {
      setTaskActionLoading(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '24px 16px 48px',
        background:
          isDark
            ? 'radial-gradient(circle at top right, rgba(99,102,241,0.18), transparent 44%), radial-gradient(circle at 15% 85%, rgba(16,185,129,0.14), transparent 48%), linear-gradient(180deg, #0f172a 0%, #0b1220 100%)'
            : 'radial-gradient(circle at top right, rgba(99,102,241,0.12), transparent 42%), radial-gradient(circle at 15% 85%, rgba(16,185,129,0.09), transparent 45%), linear-gradient(180deg, #fbfcff 0%, #f8fafc 100%)',
        borderRadius: 22,
      }}
    >

      
      <div style={{ background: '#1a1a2e', borderRadius: 20, padding: '28px 28px 24px', position: 'relative', overflow: 'hidden', marginBottom: 20, color: '#fff' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,99,255,0.35),transparent)', top: -80, right: -40, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,0.2),transparent)', bottom: -60, right: 60, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <LiveBadge status={status} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {today} • update {liveAgeSec}s lalu
            </span>
          </div>

          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>
            Halo, {firstName}! 👋
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
            {effectiveDone}/{effectiveTotal} total tugas selesai. <span style={{ whiteSpace: 'nowrap' }}>{heroMessage}</span>
          </p>
          {progressPenaltyPercent > 0 && (
            <p style={{ fontSize: 12, color: 'rgba(252,165,165,0.95)', marginTop: -10, marginBottom: 16 }}>
              Progress harian -{progressPenaltyPercent}% karena ada tugas yang tidak selesai tepat waktu.
            </p>
          )}

          <AnimatedProgressBar value={progress} status={status} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/tasks?action=new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1a1a2e', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              ＋ Tambah Tugas
            </Link>
            <button
              onClick={() => setHistoryOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.88)', border: '0.5px solid rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 10 }}
            >
              📈 Riwayat Dashboard 7 Hari
            </button>
            <Link href="/notes?action=new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '0.5px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              📓 Buat Catatan
            </Link>
            <Link href="/timer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '0.5px solid rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 10, textDecoration: 'none' }}>
              ⏱ Mulai Timer
            </Link>
          </div>
        </div>
      </div>

      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginBottom: 16 }}>
        <StatCard label="Tugas Hari Ini"  value={totalOverall}                            emoji="📋" bg="#ede9fe" color="#6c63ff" tone="violet" labelColor={dm.muted} />
        <StatCard label="Tugas Belum Siap" value={Math.max(0, totalOverall - doneOverall)} emoji="📌" bg="#e0f2fe" color="#0ea5e9" tone="blue" labelColor={dm.muted} />
        <StatCard label="Tugas Udah Siap" value={doneOverall}                             emoji="✅" bg="#dcfce7" color="#16a34a" tone="green" labelColor={dm.muted} />
        <StatCard label="Tugas Lewat Deadline" value={missedDeadlineCount}                emoji="🚨" bg="#fee2e2" color="#dc2626" tone="red" labelColor={dm.muted} />
        <StatCard label="Catatan"         value={recentNotes.length}                      emoji="📒" bg="#dcfce7" color="#10b981" tone="green" labelColor={dm.muted} />
        <StatCard label="Notifikasi Baru" value={visibleUnreadNotifs}                     emoji="🔔" bg="#fef9c3" color="#d97706" tone="amber" labelColor={dm.muted} />
      </div>

      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ background: isDark ? 'linear-gradient(160deg, #111827, #1f172a)' : 'linear-gradient(160deg, #fff, #fff7f7)', borderRadius: 16, border: `1px solid ${isDark ? '#3f1f2b' : '#fee2e2'}`, padding: 16, boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(220,38,38,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.14), transparent 65%)',
              pointerEvents: 'none',
              animation: 'radarGlow 3.2s ease-in-out infinite',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: dm.ink }}>
              Deadline Radar
            </div>
            <Link href="/tasks" style={{ fontSize: 11, color: '#ef4444', textDecoration: 'none' }}>
              Buka Tugas
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <div style={{ background: isDark ? '#2b1620' : '#fef2f2', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 12, padding: '10px 12px', boxShadow: overdueCount > 0 ? '0 0 0 2px rgba(239,68,68,0.18)' : 'none', animation: overdueCount > 0 ? 'overduePulse 1.8s ease-in-out infinite' : 'none' }}>
              <div style={{ fontSize: 10, color: '#b91c1c' }}>Overdue</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{overdueCount}</div>
            </div>
            <div style={{ background: isDark ? '#2b1c12' : '#fff7ed', border: `1px solid ${isDark ? '#9a3412' : '#fed7aa'}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#9a3412' }}>Hari Ini</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>{todayPending}</div>
            </div>
            <div style={{ background: isDark ? '#10271a' : '#f0fdf4', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#166534' }}>Mendatang</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{upcomingDue}</div>
            </div>
          </div>
          <p style={{ margin: '10px 2px 0', fontSize: 11, color: isDark ? '#fca5a5' : '#7f1d1d' }}>
            Prioritaskan item overdue dulu supaya progress harian tetap stabil.
          </p>
          <style>{`@keyframes overduePulse{0%,100%{transform:translateY(0);box-shadow:0 0 0 2px rgba(239,68,68,0.18)}50%{transform:translateY(-1px);box-shadow:0 0 0 4px rgba(239,68,68,0.14)}}@keyframes radarGlow{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}`}</style>
        </div>

        <div style={{ background: isDark ? 'linear-gradient(180deg, #111827, #1e1b4b)' : 'linear-gradient(180deg, #ffffff, #f5f3ff)', borderRadius: 16, border: `1px solid ${isDark ? '#4338ca' : '#e0e7ff'}`, overflow: 'hidden', boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(99,102,241,0.08)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -48, right: -16, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'}` }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: dm.ink }}>Aktivitas Baru</div>
            <p style={{ margin: '6px 0 0', fontSize: 10, color: dm.muted, lineHeight: 1.45 }}>
              Durasi jadwal & sisa waktu ke deadline (WIB). Pengingat otomatis 2 jam & 1 jam sebelum jadwal mulai atau deadline tugas — cek di notifikasi.
            </p>
          </div>
          <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: isDark ? '#1e1b4b' : '#eef2ff', borderRadius: 10, padding: '10px 12px', border: `1px solid ${isDark ? '#4f46e5' : '#c7d2fe'}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: dm.muted }}>Durasi jadwal hari ini</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#818cf8', marginTop: 4 }}>{formatDurationMinutes(activityMetrics?.scheduleMinutesTotal ?? 0)}</div>
              </div>
              <div style={{ background: isDark ? '#14532d' : '#f0fdf4', borderRadius: 10, padding: '10px 12px', border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: dm.muted }}>Sisa waktu ke deadline</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>{formatDurationMinutes(activityMetrics?.taskRemainingMinutesTotal ?? 0)}</div>
                <div style={{ fontSize: 9, color: dm.muted2, marginTop: 2 }}>{activityMetrics?.pendingTaskCount ?? 0} tugas belum selesai</div>
              </div>
            </div>
            {(activityMetrics?.taskRemainders?.length ?? 0) > 0 && (
              <div style={{ fontSize: 10, color: dm.sub }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: dm.ink }}>Tugas terdekat:</div>
                <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 64, overflow: 'auto' }}>
                  {(activityMetrics?.taskRemainders ?? []).slice(0, 4).map((t) => (
                    <li key={t.id} style={{ marginBottom: 3 }}>
                      {t.title} — {formatDurationMinutes(t.remainingMinutes)} lagi
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: isDark ? 'linear-gradient(180deg, #111827, #0f172a)' : 'linear-gradient(180deg, #ffffff, #f8faff)', borderRadius: 16, border: `1px solid ${isDark ? '#1f2937' : '#dbeafe'}`, overflow: 'hidden', boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(59,130,246,0.07)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -64, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.12), transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `0.5px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(79,70,229,0.08)' : 'rgba(79,70,229,0.04)' }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: dm.ink }}>
              Aktivitas Terbaru
            </div>
            <span style={{ fontSize: 11, color: dm.muted }}>{latestNotifs.length} item</span>
          </div>
          {latestNotifs.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: dm.muted }}>Belum ada notifikasi terbaru.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', height: 136, overflowY: 'auto', scrollbarGutter: 'stable' }}>
              {latestNotifs.map((n) => (
                <li
                  key={n.id}
                  onClick={() => setActiveNotifId(n.id)}
                  style={{
                    padding: '11px 16px',
                    borderBottom: `0.5px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.05)'}`,
                    background: n.isRead ? (isDark ? '#0f172a' : '#fff') : (isDark ? '#1e293b' : '#eef2ff'),
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 8, background: notificationTone(n.type).bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                        {notificationTone(n.type).badge}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: dm.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: dm.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                        <div style={{ fontSize: 10.5, color: dm.muted2, marginTop: 2 }}>
                          {new Date(n.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: notificationTone(n.type).dot, flexShrink: 0 }} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {activeNotif && (
        <div
          onClick={() => setActiveNotifId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 18px 44px rgba(15,23,42,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, background: notificationTone(activeNotif.type).bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  {notificationTone(activeNotif.type).badge}
                </span>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>Detail Aktivitas</strong>
              </div>
              <button onClick={() => setActiveNotifId(null)} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '16px 16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>{activeNotif.title}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 10 }}>{activeNotif.message}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Waktu: {new Date(activeNotif.createdAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>

        
        <div style={{ background: isDark ? 'linear-gradient(180deg, #111827, #18122b)' : 'linear-gradient(180deg, #ffffff, #faf7ff)', borderRadius: 16, border: `1px solid ${isDark ? '#312e81' : '#ddd6fe'}`, overflow: 'hidden', boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(124,58,237,0.06)' }}>
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
              <p style={{ fontSize: 13, color: dm.muted, margin: 0 }}>Semua beres hari ini!</p>
              <p style={{ fontSize: 11, color: dm.muted2, margin: 0 }}>Nice, kamu lagi ahead 🚀</p>
            </div>
          ) : (
            <ul style={{ padding: 0, margin: 0, height: 136, overflowY: 'auto', scrollbarGutter: 'stable' }}>
              {sortedTodayTasks.map((task) => {
                const pc = priorityConfig[task.priority] ?? priorityConfig.LOW
                const isDone = task.status === 'DONE'
                const rowChallenge = challengeMap[task.id]
                const rowTimer = rowChallenge
                  ? formatClock(Math.max(0, rowChallenge.targetMinutes * 60 - Math.max(0, Math.floor((challengeTick - rowChallenge.startedAt) / 1000))))
                  : ''
                return (
                  <TaskItem
                    key={task.id}
                    title={task.title}
                    subject={task.subject}
                    dot={isDone ? '#94a3b8' : pc.dot}
                    badgeBg={isDone ? '#e2e8f0' : pc.bg}
                    badgeText={isDone ? '#475569' : pc.text}
                    badgeLabel={isDone ? 'Selesai' : pc.label}
                    done={isDone}
                    centerInfo={task.status === 'IN_PROGRESS' && rowTimer ? rowTimer : undefined}
                    onClick={() => setActiveTaskId(task.id)}
                  />
                )
              })}
            </ul>
          )}
        </div>

        <div style={{ background: isDark ? 'linear-gradient(180deg, #111827, #0c1a24)' : 'linear-gradient(180deg, #ffffff, #f0fdfa)', borderRadius: 16, border: `1px solid ${isDark ? '#115e59' : '#99f6e4'}`, overflow: 'hidden', boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(13,148,136,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📅</span>
              <span>Jadwal Hari Ini</span>
              <button
                type="button"
                onClick={() => setScheduleInfoOpen(true)}
                aria-label="Info jadwal kuliah"
                title="Info"
                style={{
                  border: 0,
                  background: 'rgba(13,148,136,0.12)',
                  color: '#0f766e',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="bi bi-info-circle" aria-hidden />
              </button>
            </div>
            <Link href="/calendar" style={{ fontSize: 11, color: '#0d9488', textDecoration: 'none', padding: '4px 10px', border: '0.5px solid #99f6e4', borderRadius: 8 }}>
              Kalender
            </Link>
          </div>
          <div style={{ padding: '0 16px 10px', fontSize: 10, color: dm.muted, lineHeight: 1.35 }}>
            Kuliah & sekolah · hari {scheduleWeekdayLabel} (WIB)
          </div>
          {todaySchedule.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</div>
              <p style={{ fontSize: 13, color: dm.muted, margin: 0, textAlign: 'center' }}>Belum ada jadwal untuk hari ini</p>
              <Link href="/calendar" style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>
                Atur di Kalender →
              </Link>
            </div>
          ) : (
            <ul style={{ padding: 0, margin: 0, height: 136, overflowY: 'auto', scrollbarGutter: 'stable' }}>
              {todaySchedule.map((s) => {
                const timePart = [s.startTime, s.endTime].filter(Boolean).join(' – ')
                const sub = [timePart, s.place].filter(Boolean).join(' · ')
                return (
                  <TaskItem
                    key={s.id}
                    title={s.title}
                    subject={sub || undefined}
                    dot="#0d9488"
                    badgeBg="#ccfbf1"
                    badgeText="#0f766e"
                    badgeLabel="Jadwal"
                  />
                )
              })}
            </ul>
          )}
        </div>

        <div style={{ background: isDark ? 'linear-gradient(180deg, #111827, #10271a)' : 'linear-gradient(180deg, #ffffff, #f3fff8)', borderRadius: 16, border: `1px solid ${isDark ? '#166534' : '#bbf7d0'}`, overflow: 'hidden', boxShadow: isDark ? '0 12px 24px rgba(2,6,23,0.35)' : '0 12px 24px rgba(22,163,74,0.06)' }}>
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
              <p style={{ fontSize: 13, color: dm.muted, margin: 0 }}>Belum ada catatan</p>
              <p style={{ fontSize: 11, color: dm.muted2, margin: 0 }}>Mulai nulis, ide kamu worth it ✨</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, padding: 12 }}>
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

      {activeTask && (
        <div
          onClick={() => setActiveTaskId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: 'var(--sh-card-bg)',
              borderRadius: 16,
              border: '1px solid var(--sh-border)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: '#0f172a' }}>Detail Tugas</strong>
              <button onClick={() => setActiveTaskId(null)} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '16px 16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 10 }}>{activeTask.title}</div>
              {activeTask.description && (
                <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px', lineHeight: 1.5 }}>
                  {activeTask.description}
                </div>
              )}
              {activeTask.subject && (
                <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 8 }}>
                  Mata Pelajaran: <strong>{activeTask.subject}</strong>
                </div>
              )}
              {activeTask.deadline && (
                <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 8 }}>
                  Deadline: <strong>{new Date(activeTask.deadline).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</strong>
                </div>
              )}
              <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 6 }}>
                Prioritas: <strong>{priorityConfig[activeTask.priority]?.label ?? 'Rendah'}</strong>
              </div>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                Status: <strong>{activeTask.status === 'DONE' ? 'Selesai' : activeTask.status === 'IN_PROGRESS' ? 'Sedang Dikerjakan' : 'Belum Mulai'}</strong>
              </div>
              <div style={{ marginTop: 10 }}>
                <Link
                  href={`/ai-tutor?ask=${encodeURIComponent(
                    `Aku bingung tentang tugas ini.\nJudul: ${activeTask.title}\nDeskripsi: ${activeTask.description || '-'}\nBantu jelaskan langkah mengerjakannya dengan simpel ya.`
                  )}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid #c7d2fe',
                    background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
                    color: '#3730a3',
                    borderRadius: 10,
                    padding: '7px 11px',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 8px 16px rgba(79,70,229,0.15)',
                  }}
                >
                  <span>🤖</span>
                  Bingung? Tanya AI aja
                </Link>
              </div>
              {activeTaskStatus === 'IN_PROGRESS' && activeChallenge && (
                <div style={{ marginTop: 10, background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', border: '1px solid #c7d2fe', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#4338ca', marginBottom: 4 }}>Waktu: sisa waktu (real-time)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#312e81', fontVariantNumeric: 'tabular-nums' }}>
                    {formatClock(challengeRemainingSec)}
                  </div>
                </div>
              )}
              {challengeSummary && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#0f766e', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '8px 10px' }}>
                  {challengeSummary}
                </div>
              )}
              {activeTaskStatus === 'TODO' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setChallengeOpen((v) => !v)}
                    disabled={taskActionLoading}
                    style={{
                      border: '1px solid #c7d2fe',
                      background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)',
                      color: '#3730a3',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 6px 14px rgba(79,70,229,0.12)',
                    }}
                  >
                    <span style={{ marginRight: 6 }}>🚀</span>
                    Mulai Kerjain
                  </button>
                  <button
                    onClick={completeTaskNow}
                    disabled={taskActionLoading}
                    style={{
                      border: '1px solid #86efac',
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 8px 16px rgba(34,197,94,0.22)',
                    }}
                  >
                    <span style={{ marginRight: 6 }}>✅</span>
                    Selesai
                  </button>
                </div>
              )}
              {activeTaskStatus === 'IN_PROGRESS' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    onClick={completeTaskNow}
                    disabled={taskActionLoading}
                    style={{
                      border: '1px solid #86efac',
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 8px 16px rgba(34,197,94,0.22)',
                    }}
                  >
                    <span style={{ marginRight: 6 }}>✅</span>
                    Selesai
                  </button>
                </div>
              )}
              {challengeOpen && activeTaskStatus === 'TODO' && (
                <div style={{ marginTop: 10, border: '1px solid #c7d2fe', borderRadius: 12, padding: 10, background: 'linear-gradient(180deg,#f8faff,#eef2ff)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3', marginBottom: 8 }}>
                    Mini Challenge: kira-kira selesai dalam berapa menit?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      value={challengeMinutes}
                      onChange={(e) => setChallengeMinutes(e.target.value)}
                      style={{ width: 92, border: '1px solid #a5b4fc', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff' }}
                    />
                    <button
                      onClick={startTaskChallenge}
                      disabled={taskActionLoading}
                      style={{
                        border: '1px solid #6366f1',
                        background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: '0 8px 16px rgba(79,70,229,0.24)',
                      }}
                    >
                      <span style={{ marginRight: 6 }}>⏱</span>
                      Mulai Sekarang
                    </button>
                  </div>
                </div>
              )}
              {activeTaskStatus === 'IN_PROGRESS' && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#6366f1' }}>
                  Challenge sudah dimulai.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14, background: 'linear-gradient(180deg, #ffffff, #f8faff)', borderRadius: 16, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 12px 24px rgba(59,130,246,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'rgba(59,130,246,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📅</span>
            Tugas Mendatang
          </div>
          <Link href="/tasks" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', padding: '4px 10px', border: '0.5px solid #bfdbfe', borderRadius: 8 }}>
            Lihat Semua
          </Link>
        </div>
        {upcomingTasks.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: '#94a3b8' }}>
            Belum ada tugas mendatang. Yang lewat deadline tidak ditampilkan di sini.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', height: 156, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            {upcomingTasks.map((task) => (
              <li key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderBottom: '0.5px solid #eef2f7' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: task.status === 'DONE' ? '#64748b' : '#1f2937', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.subject || 'Tanpa mapel'} • {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {task.status === 'DONE' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 999, padding: '2px 8px' }}>
                      Selesai
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '2px 8px' }}>
                    {priorityConfig[task.priority]?.label ?? 'Sedang'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(620px, 100%)',
              background: 'var(--sh-card-bg)',
              borderRadius: 16,
              border: '1px solid var(--sh-border)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 14, color: '#0f172a' }}>Riwayat Dashboard (Semua Ringkasan · 7 Hari)</strong>
              <button onClick={() => setHistoryOpen(false)} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #eef2f7', background: '#f8fafc', color: '#475569', fontSize: 12 }}>
              Data dashboard direset otomatis tiap pergantian hari (00:00), dan histori disimpan maksimal 7 hari.
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: '#94a3b8' }}>Belum ada data riwayat.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Tanggal</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Selesai</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Pending</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Overdue</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((d) => (
                      <tr key={String(d.date)}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#1f2937' }}>
                          {new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{d.totalTasks}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#16a34a' }}>{d.doneTasks}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#2563eb' }}>{d.pendingTasks}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#dc2626' }}>{d.overdueTasks}</td>
                        <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{d.progress}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      
      {scheduleInfoOpen && (
        <div
          role="dialog"
          aria-modal
          onClick={() => setScheduleInfoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: '18px 18px 16px',
              boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
            }}
          >
            <h6 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>Tentang Jadwal Hari Ini</h6>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 16 }}>
              Kotak ini menampilkan jadwal sekolah atau kuliah untuk hari ini menurut zona WIB (Senin–Minggu), bisa lebih dari satu mapel per hari. Ubah atau tambah jadwal di halaman Kalender lewat tombol Tambah jadwal.
            </p>
            <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => setScheduleInfoOpen(false)}>
              Mengerti
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
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