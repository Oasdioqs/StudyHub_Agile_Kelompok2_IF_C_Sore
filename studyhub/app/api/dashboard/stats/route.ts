import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadDashboardStats } from '@/lib/dashboard-load'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stats = await loadDashboardStats(session.user.id)
  return NextResponse.json(stats)
}
