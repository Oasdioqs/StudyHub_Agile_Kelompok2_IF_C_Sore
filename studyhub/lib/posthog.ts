import { PostHog } from 'posthog-node'

let _client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
    })
  }
  return _client
}

export function captureServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const client = getPostHogServer()
  if (!client) return
  client.capture({ distinctId: userId, event, properties })
}
