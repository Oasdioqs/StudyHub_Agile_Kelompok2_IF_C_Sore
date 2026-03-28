import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadDashboardStats } from '@/lib/dashboard-load'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  const encoder = new TextEncoder()

  const send = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

  const stream = new ReadableStream({
    async start(controller) {
      let lastHash = ''
      let running = true

      const check = async () => {
        if (!running) return
        let nextDelay = 5_000
        try {
          const stats = await loadDashboardStats(userId, { skipReminders: true })
          const hash = JSON.stringify(stats)
          if (hash !== lastHash) {
            lastHash = hash
            controller.enqueue(send(stats))
          }
        } catch {
          nextDelay = 12_000
        }

        if (running) {
          setTimeout(check, nextDelay)
        }
      }

      try {
        const stats = await loadDashboardStats(userId, { skipReminders: true })
        lastHash = JSON.stringify(stats)
        controller.enqueue(send(stats))
      } catch {
        controller.close()
        return
      }

      setTimeout(check, 5_000)

      const heartbeat = setInterval(() => {
        if (!running) {
          clearInterval(heartbeat)
          return
        }
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
