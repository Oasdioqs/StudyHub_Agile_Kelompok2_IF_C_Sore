'use client'

import { useEffect, useRef, useState } from 'react'

export interface DashboardStats {
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
  doneToday:     number
  totalToday:    number
  doneOverall:   number
  totalOverall:  number
  totalActive:   number
  todayPending:  number
  upcomingDue:   number
  missedDeadlineCount: number
  progressPenaltyPercent: number
  progress:      number
  overdueCount:  number
  recentNotes:   { id: string; title: string; content: string }[]
  latestNotifs:  { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string | Date }[]
  unreadNotifs:  number
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
  activityMetrics: {
    scheduleMinutesTotal: number
    taskRemainingMinutesTotal: number
    pendingTaskCount: number
    taskRemainders: { id: string; title: string; remainingMinutes: number }[]
  }
}

type Status = 'connecting' | 'live' | 'reconnecting' | 'offline'

const emptyActivity: DashboardStats['activityMetrics'] = {
  scheduleMinutesTotal: 0,
  taskRemainingMinutesTotal: 0,
  pendingTaskCount: 0,
  taskRemainders: [],
}

export function useDashboardStream(initial: DashboardStats) {
  const [stats, setStats] = useState<DashboardStats>(() => ({
    ...initial,
    activityMetrics: initial.activityMetrics ?? emptyActivity,
  }))
  const [status, setStatus] = useState<Status>('connecting')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
  const esRef    = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attempt  = useRef(0)

  const connect = () => {
    esRef.current?.close()
    if (retryRef.current) clearTimeout(retryRef.current)

    const es = new EventSource('/api/dashboard/stream')
    esRef.current = es

    es.onopen = () => {
      setStatus('live')
      attempt.current = 0
    }

    es.onmessage = (e) => {
      try {
        const data: DashboardStats = JSON.parse(e.data)
        setStats({
          ...data,
          activityMetrics: data.activityMetrics ?? emptyActivity,
        })
        setStatus('live')
        setLastUpdatedAt(Date.now())
      } catch {  }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null

      attempt.current += 1
      const delay = Math.min(1000 * Math.pow(2, attempt.current), 30_000)
      setStatus(attempt.current <= 2 ? 'reconnecting' : 'offline')
      retryRef.current = setTimeout(connect, delay)
    }
  }

  useEffect(() => {
    connect()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !esRef.current) connect()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      esRef.current?.close()
      if (retryRef.current) clearTimeout(retryRef.current)
      if (healthRef.current) clearInterval(healthRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    if (healthRef.current) clearInterval(healthRef.current)
    healthRef.current = setInterval(() => {
      const age = Date.now() - lastUpdatedAt
      if (age > 12000 && age <= 30000) {
        setStatus((prev) => (prev === 'offline' ? prev : 'reconnecting'))
      } else if (age > 30000) {
        setStatus('offline')
      }
    }, 3000)

    return () => {
      if (healthRef.current) clearInterval(healthRef.current)
    }
  }, [lastUpdatedAt])

  return { stats, status, lastUpdatedAt }
}