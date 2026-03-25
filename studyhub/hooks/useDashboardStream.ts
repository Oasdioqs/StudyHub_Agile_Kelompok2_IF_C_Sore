// hooks/useDashboardStream.ts
'use client'

import { useEffect, useRef, useState } from 'react'

export interface DashboardStats {
  todayTasks: {
    id: string
    title: string
    subject?: string | null
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    status: string
  }[]
  doneToday:     number
  totalToday:    number
  progress:      number
  upcomingCount: number
  recentNotes:   { id: string; title: string; content: string }[]
  unreadNotifs:  number
}

type Status = 'connecting' | 'live' | 'reconnecting' | 'offline'

export function useDashboardStream(initial: DashboardStats) {
  const [stats, setStats]   = useState<DashboardStats>(initial)
  const [status, setStatus] = useState<Status>('connecting')
  const esRef    = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
        setStats(data)
        setStatus('live')
      } catch { /* ignore parse errors */ }
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
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { stats, status }
}