// app/api/dashboard/stream/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

async function fetchStats(userId: string) {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
  const todayEnd   = new Date(new Date().setHours(23, 59, 59, 999))

  const [todayTasks, completedTodayTasks, upcomingTasks, recentNotes, unreadNotifs] =
    await Promise.all([
      db.task.findMany({
        where: { userId, deadline: { gte: todayStart, lte: todayEnd } },
        select: { id: true, title: true, subject: true, priority: true, status: true },
      }),
      db.task.findMany({
        where: { userId, status: 'DONE', deadline: { gte: todayStart, lte: todayEnd } },
        select: { id: true },
      }),
      db.task.findMany({
        where: { userId, status: { not: 'DONE' }, deadline: { gte: new Date() } },
        orderBy: { deadline: 'asc' },
        take: 5,
        select: { id: true },
      }),
      db.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: { id: true, title: true, content: true },
      }),
      db.notification.count({ where: { userId, isRead: false } }),
    ])

  const totalToday = todayTasks.length
  const doneToday  = completedTodayTasks.length
  const progress   = totalToday === 0 ? 100 : Math.round((doneToday / totalToday) * 100)

  return {
    todayTasks,
    doneToday,
    totalToday,
    progress,
    upcomingCount: upcomingTasks.length,
    recentNotes,
    unreadNotifs,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  const encoder = new TextEncoder()

  const send = (data: unknown) =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

  const stream = new ReadableStream({
    async start(controller) {
      let lastHash = ''
      let running  = true

      const check = async () => {
        if (!running) return
        try {
          const stats = await fetchStats(userId)
          const hash  = JSON.stringify(stats)
          if (hash !== lastHash) {
            lastHash = hash
            controller.enqueue(send(stats))
          }
        } catch {
        }

        if (running) {
          setTimeout(check, 3_000)
        }
      }

      try {
        const stats = await fetchStats(userId)
        lastHash    = JSON.stringify(stats)
        controller.enqueue(send(stats))
      } catch {
        controller.close()
        return
      }

      setTimeout(check, 3_000)

      const heartbeat = setInterval(() => {
        if (!running) { clearInterval(heartbeat); return }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      return () => {
        running = false
        clearInterval(heartbeat)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}