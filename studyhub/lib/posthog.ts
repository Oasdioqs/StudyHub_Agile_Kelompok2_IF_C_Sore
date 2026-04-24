import { PostHog } from 'posthog-node'

let _client: PostHog | null = null

/**
 * Get PostHog server client.
 * Uses server-side key (POSTHOG_API_KEY) for server-side operations.
 * The client-side key (NEXT_PUBLIC_POSTHOG_KEY) should only be used by the browser SDK.
 */
export function getPostHogServer(): PostHog | null {
  // Prefer server-side key, fallback to public key if not set
  const apiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return null
  if (!_client) {
    _client = new PostHog(apiKey, {
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

  // Sanitize event name and properties
  const sanitizedEvent = String(event).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 100)
  const sanitizedProperties = sanitizeProperties(properties || {})

  client.capture({ distinctId: userId, event: sanitizedEvent, properties: sanitizedProperties })
}

/**
 * Sanitize properties to prevent injection attacks.
 */
function sanitizeProperties(props: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50)
    if (typeof value === 'string') {
      sanitized[safeKey] = value.slice(0, 1000)
    } else if (typeof value === 'number') {
      sanitized[safeKey] = isFinite(value) ? value : 0
    } else if (typeof value === 'boolean') {
      sanitized[safeKey] = Boolean(value)
    } else {
      sanitized[safeKey] = String(value).slice(0, 500)
    }
  }
  return sanitized
}
