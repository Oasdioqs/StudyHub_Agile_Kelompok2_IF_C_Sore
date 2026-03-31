import { OAuth2Client } from 'google-auth-library'
import { encode } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const MAX_AGE_SEC = 30 * 24 * 60 * 60

function googleAudiences(): string[] {
  const combined = process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID
  if (!combined?.trim()) return []
  return combined
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  const audiences = googleAudiences()
  if (audiences.length === 0) {
    return NextResponse.json({ error: 'Google login belum dikonfigurasi di server (GOOGLE_CLIENT_ID).' }, { status: 503 })
  }

  let body: { idToken?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const idToken = body.idToken?.trim()
  if (!idToken) {
    return NextResponse.json({ error: 'idToken wajib diisi' }, { status: 400 })
  }

  const client = new OAuth2Client()
  let email: string
  let name: string
  let picture: string | undefined

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    })
    const p = ticket.getPayload()
    if (!p?.email) {
      return NextResponse.json({ error: 'Email tidak tersedia dari Google' }, { status: 400 })
    }
    email = p.email.toLowerCase()
    name = (p.name || p.given_name || email.split('@')[0]).slice(0, 120)
    picture = p.picture
  } catch {
    return NextResponse.json({ error: 'Token Google tidak valid atau sudah kedaluwarsa' }, { status: 401 })
  }

  let user = await db.user.findUnique({ where: { email } })
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name,
        image: picture ?? null,
        emailVerified: new Date(),
      },
    })
  } else if (picture && !user.image) {
    user = await db.user.update({
      where: { id: user.id },
      data: { image: picture },
    })
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const token = await encode({
    token: {
      name: user.name,
      email: user.email,
      picture: user.image,
      sub: user.id,
      id: user.id,
    },
    secret,
    maxAge: MAX_AGE_SEC,
  })

  return NextResponse.json({
    token,
    expiresIn: MAX_AGE_SEC,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
  })
}
