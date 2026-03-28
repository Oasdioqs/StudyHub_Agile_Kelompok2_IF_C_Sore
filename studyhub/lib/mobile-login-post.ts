import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'
import { db } from '@/lib/db'

const MAX_AGE_SEC = 30 * 24 * 60 * 60

export async function postMobileLogin(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user?.password) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
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
