import { NextRequest, NextResponse } from 'next/server'

type RateLimitEntry = { count: number; resetAt: number }

// In-memory store — works for single-instance dev/staging.
// For multi-instance production on Vercel, replace with Upstash Redis:
// https://upstash.com/docs/redis/sdks/ratelimit
const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    Array.from(store.entries()).forEach(([key, entry]) => {
      if (now > entry.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  keyPrefix?: string
}

export function checkRateLimit(
  identifier: string,
  { limit, windowMs, keyPrefix = 'rl' }: RateLimitOptions,
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${keyPrefix}:${identifier}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// Preset configs
export const RATE_LIMITS = {
  // Auth: 10 attempts per 15 minutes per IP
  auth: { limit: 10, windowMs: 15 * 60 * 1000, keyPrefix: 'auth' },
  // Register: 5 per hour per IP (stricter)
  register: { limit: 5, windowMs: 60 * 60 * 1000, keyPrefix: 'register' },
  // AI: 30 requests per hour per user
  ai: { limit: 30, windowMs: 60 * 60 * 1000, keyPrefix: 'ai' },
  // API general: 100 per minute per IP
  api: { limit: 100, windowMs: 60 * 1000, keyPrefix: 'api' },
  // Forgot password: 3 per hour per IP
  forgotPassword: { limit: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'forgot' },
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba lagi beberapa menit.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  )
}
