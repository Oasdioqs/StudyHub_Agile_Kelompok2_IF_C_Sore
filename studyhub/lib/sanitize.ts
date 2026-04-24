import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize user input to prevent XSS attacks.
 * Strips all HTML tags and dangerous characters.
 */
export function sanitizeName(input: string): string {
  const trimmed = String(input || '').trim()

  // First, use DOMPurify to strip any HTML/JS
  const purified = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  })

  // Additional safety: remove any remaining HTML entities that could be exploited
  return purified
    .replace(/[<>'"&]/g, '') // Remove dangerous characters
    .replace(/&lt;|&gt;|&amp;|&quot;|&#/g, '') // Remove HTML entities
    .trim()
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

/**
 * Sanitize email (normalize format but keep the actual value for database).
 */
export function sanitizeEmail(input: string): string {
  return String(input || '').trim().toLowerCase()
}

/**
 * Sanitize referral code (alphanumeric only).
 */
export function sanitizeRefCode(input: string): string | null {
  const code = String(input || '').trim().toUpperCase()
  if (!code) return null
  // Only allow alphanumeric characters
  return code.replace(/[^A-Z0-9]/g, '').slice(0, 20) || null
}

/**
 * Sanitize OTP code (digits only, 6 characters).
 */
export function sanitizeOtpCode(input: string): string | null {
  const code = String(input || '').replace(/\D/g, '').slice(0, 6)
  return code.length === 6 ? code : null
}

/**
 * Escape HTML entities for safe output in HTML context.
 */
export function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return String(input).replace(/[&<>"']/g, (char) => map[char])
}
