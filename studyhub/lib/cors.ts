import { NextRequest, NextResponse } from 'next/server'

// Allowed origins for CORS - restrict to specific domains only
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]
  : [
      'https://studyhubs.my.id',
      'https://www.studyhubs.my.id',
    ]

/**
 * Check if the origin is allowed.
 * In production, only allow requests from our own domain.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  return allowedOrigins.includes(origin)
}

/**
 * Get CORS headers based on the request origin.
 * Only allows requests from whitelisted origins.
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')

  // In production, we don't allow wildcard CORS
  // Only allow requests from our own domain
  if (isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin as string,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    }
  }

  // For disallowed origins, don't include CORS headers
  // This prevents cross-origin attacks while maintaining same-origin functionality
  return {}
}

/**
 * Handle OPTIONS request for CORS preflight.
 */
export function handleCorsPreflight(request: NextRequest): NextResponse {
  const headers = getCorsHeaders(request)
  return new NextResponse(null, {
    status: 204,
    headers,
  })
}

/**
 * Apply CORS headers to a response.
 */
export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  const headers = getCorsHeaders(request)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}
