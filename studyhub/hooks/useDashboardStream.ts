'use client'

import { useEffect, useRef, useState } from 'react'

export interface DashboardStats {
  _dbError?: boolean
  todayTasks: {
    id: string
    title: string
    description?: string | null
    subject?: string | null
    deadline?: string | Date | null
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    status: string
    createdAt?: string | Date
  }[]
  upcomingTasks: {
    id: string
    title: string
    subject?: string | null
    deadline?: string | Date | null
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    status: string
  }[]
  doneToday: number
  totalToday: number
  doneOverall: number
  totalOverall: number
  totalActive: number
  todayPending: number
  upcomingDue: number
  missedDeadlineCount: number
  progressPenaltyPercent: number
  progress: number
  overdueCount: number
  recentNotes: { id: string; title: string; content: string }[]
  latestNotifs: { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string | Date }[]
  unreadNotifs: number
  history: {
    date: string | Date
    totalTasks: number
    doneTasks: number
    pendingTasks: number
    overdueTasks: number
    progress: number
  }[]
  todaySchedule: {
    id: string
    dayOfWeek: number
    title: string
    startTime: string | null
    endTime: string | null
    place: string | null
  }[]
}

type Status = 'connecting' | 'live' | 'reconnecting' | 'offline'

export function useDashboardStream(initial: DashboardStats) {
  const [stats, setStats] = useState<DashboardStats>(initial)
  const [status, setStatus] = useState<Status>('connecting')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
  const [fetchError, setFetchError] = useState<boolean>(initial._dbError ?? false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)

  const fetchOnce = async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const res = await fetch('/api/dashboard/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as DashboardStats & { _fetchError?: boolean }
      if (data._fetchError) {
        // Server got partial/no data — keep existing stats, flag the error
        setFetchError(true)
        setStatus((prev) => (prev === 'live' ? 'reconnecting' : 'offline'))
      } else {
        setStats(data)
        setFetchError(false)
        setStatus('live')
        setLastUpdatedAt(Date.now())
      }
    } catch {
      setFetchError(true)
      setStatus((prev) => (prev === 'live' ? 'reconnecting' : 'offline'))
    } finally {
      busyRef.current = false
    }
  }

  const refetch = () => { void fetchOnce() }

  useEffect(() => {
    void fetchOnce()
    pollRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void fetchOnce()
    }, 5 * 60_000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchOnce()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (healthRef.current) clearInterval(healthRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    if (healthRef.current) clearInterval(healthRef.current)
    healthRef.current = setInterval(() => {
      const age = Date.now() - lastUpdatedAt
      if (age > 60_000 && age <= 180_000) {
        setStatus((prev) => (prev === 'offline' ? prev : 'reconnecting'))
      } else if (age > 180_000) {
        setStatus('offline')
      }
    }, 3000)

    return () => {
      if (healthRef.current) clearInterval(healthRef.current)
    }
  }, [lastUpdatedAt])

  return { stats, status, lastUpdatedAt, fetchError, refetch }
}
