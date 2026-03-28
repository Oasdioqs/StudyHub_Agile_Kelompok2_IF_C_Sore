import { decode } from 'next-auth/jwt'
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'

/**
 * Resolves the current user id from cookie session (web) or
 * Authorization: Bearer <jwt> (mobile app using POST /api/mobile/login).
 */
export async function getUserIdFromRequest(_req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return session.user.id

  const auth = _req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const raw = auth.slice(7).trim()
  if (!raw || !process.env.NEXTAUTH_SECRET) return null

  try {
    const decoded = await decode({
      token: raw,
      secret: process.env.NEXTAUTH_SECRET,
    })
    if (!decoded || typeof decoded !== 'object') return null
    const d = decoded as { id?: string; sub?: string }
    return d.id ?? d.sub ?? null
  } catch {
    return null
  }
}
