import { loadDashboardStats } from '@/lib/dashboard-load'
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/api-session'

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stats = await loadDashboardStats(userId)
  return NextResponse.json(stats)
}
