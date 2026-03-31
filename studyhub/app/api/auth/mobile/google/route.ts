import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { db } from '@/lib/db'

const MAX_AGE_SEC = 30 * 24 * 60 * 60

export async function POST(req: NextRequest) {
  let body: { email?: string; name?: string; image?: string; googleId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
  }

  let user = await db.user.findUnique({ where: { email } })

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: body.name || email.split('@')[0],
        image: body.image || null,
        emailVerified: new Date(),
      },
    })
  }

  if (!user.emailVerified) {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })
  }

  if (body.googleId) {
    const existingAccount = await db.account.findFirst({
      where: { userId: user.id, provider: 'google' },
    })
    if (!existingAccount) {
      await db.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: body.googleId,
        },
      })
    }
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
