import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json(
      { message: 'Token dan password wajib diisi' },
      { status: 400 }
    )
  }

  // 🔍 cari user berdasarkan token + belum expired
  const user = await db.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      { message: 'Token tidak valid atau sudah expired' },
      { status: 400 }
    )
  }

  // 🔐 hash password baru
  const hashedPassword = await bcrypt.hash(password, 12)

  // 💾 update password + hapus token
  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  })

  return NextResponse.json({
    message: 'Password berhasil diubah',
  })
}