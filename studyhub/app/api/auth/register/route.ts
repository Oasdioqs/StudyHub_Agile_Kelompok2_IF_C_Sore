// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Semua field wajib diisi' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'Email sudah digunakan' }, { status: 409 })
  }

  const existingName = await db.user.findFirst({ where: { name } })
  if (existingName) {
    return NextResponse.json({ message: 'Nama sudah digunakan' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: { name, email, password: hashed },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json(user, { status: 201 })
}
