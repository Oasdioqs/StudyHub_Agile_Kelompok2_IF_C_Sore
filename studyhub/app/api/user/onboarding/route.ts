import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserIdFromRequest } from '@/lib/api-session'
import { db } from '@/lib/db'

const OnboardingSchema = z.object({
  institution: z.string().max(100).optional(),
  major: z.string().max(100).optional(),
  bio: z.string().max(300).optional(),
})

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })

  await db.user.update({
    where: { id: userId },
    data: {
      ...parsed.data,
      onboardingDone: true,
    },
  })

  return NextResponse.json({ ok: true })
}
