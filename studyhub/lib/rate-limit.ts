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
  // OTP Verification: 5 attempts per 10 minutes per email+IP combo (prevent brute force)
  otpVerify: { limit: 5, windowMs: 10 * 60 * 1000, keyPrefix: 'otp' },
  // OTP Verify Strict: 3 attempts per 15 minutes per email (for failed attempts tracking)
  otpFailed: { limit: 3, windowMs: 15 * 60 * 1000, keyPrefix: 'otpf' },
  // AI: 30 requests per hour per user
  ai: { limit: 30, windowMs: 60 * 60 * 1000, keyPrefix: 'ai' },
  // API general: 100 per minute per IP
  api: { limit: 100, windowMs: 60 * 1000, keyPrefix: 'api' },
  // Forgot password: 3 per hour per IP
  forgotPassword: { limit: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'forgot' },
}

// Track failed OTP attempts in memory (per email)
const failedOtpStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Check if an email has exceeded failed OTP attempts.
 * After 3 failed attempts, lock for 15 minutes.
 */
export function checkFailedOtp(email: string): { blocked: boolean; remaining: number; resetAt: number } {
  const key = `otpf:${email.toLowerCase()}`
  const now = Date.now()
  const entry = failedOtpStore.get(key)

  if (!entry || now > entry.resetAt) {
    return { blocked: false, remaining: 2, resetAt: now + 15 * 60 * 1000 }
  }

  if (entry.count >= 3) {
    return { blocked: true, remaining: 0, resetAt: entry.resetAt }
  }

  return { blocked: false, remaining: 2 - entry.count, resetAt: entry.resetAt }
}

/**
 * Record a failed OTP attempt.
 */
export function recordFailedOtp(email: string): void {
  const key = `otpf:${email.toLowerCase()}`
  const now = Date.now()
  const entry = failedOtpStore.get(key)

  if (!entry || now > entry.resetAt) {
    failedOtpStore.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return
  }

  entry.count++
  // Extend reset time if approaching limit
  if (entry.count >= 3) {
    entry.resetAt = now + 15 * 60 * 1000
  }
}

/**
 * Clear failed OTP attempts (on successful verification).
 */
export function clearFailedOtp(email: string): void {
  const key = `otpf:${email.toLowerCase()}`
  failedOtpStore.delete(key)
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
