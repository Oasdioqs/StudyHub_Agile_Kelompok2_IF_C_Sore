import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadDashboardStats } from '@/lib/dashboard-load'

// Vercel serverless max duration
export const maxDuration = 25

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id

  const encoder = new TextEncoder()

  const send = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

  // Compatibility endpoint: send one snapshot and close.
  // Long-lived SSE in serverless caused timeout + reconnect storm.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stats = await loadDashboardStats(userId, { skipReminders: true })
        controller.enqueue(send(stats))
      } catch {}
      controller.close()
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
