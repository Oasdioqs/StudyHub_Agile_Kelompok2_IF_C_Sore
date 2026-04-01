import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { resendVerificationEmail } from '@/lib/mail'
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String((body as any).name || '').trim()
  const email = String((body as any).email || '').trim().toLowerCase()
  const password = String((body as any).password || '')

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

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashed,
      // emailVerified: new Date(), dihapus agar user wajib verifikasi email
    },
    select: { id: true, name: true, email: true },
  })

  const sendResult = await resendVerificationEmail(user.email)
  if ((sendResult as any)?.error) {
    return NextResponse.json(
      {
        ...user,
        warning:
          (sendResult as any).error.message ||
          'Akun berhasil dibuat, tapi email verifikasi belum berhasil dikirim. Coba kirim ulang dari halaman login.',
      },
      { status: 201 },
    )
  }

  return NextResponse.json(user, { status: 201 })
}
