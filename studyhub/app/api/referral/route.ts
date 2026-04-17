import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-session'
import { db } from '@/lib/db'

// Buat kode referral yang pendek dan mudah dibagikan
function generateReferralCode(name: string, id: string): string {
  const cleanName = name.replace(/\s+/g, '').toUpperCase().slice(0, 4)
  const suffix = id.slice(-4).toUpperCase()
  return `${cleanName}${suffix}`
}

// GET — ambil atau buat referral code user
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, referralCount: true, name: true, id: true },
  })

  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

  // Buat referral code jika belum ada
  if (!user.referralCode) {
    const code = generateReferralCode(user.name, user.id)
    user = await db.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: { referralCode: true, referralCount: true, name: true, id: true },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://studyhub-olive.vercel.app'

  return NextResponse.json({
    code: user.referralCode,
    count: user.referralCount,
    link: `${baseUrl}/auth/register?ref=${user.referralCode}`,
  })
}
