import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/leaderboard — top 50 users by points
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const users = await db.user.findMany({
    orderBy: { points: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      image: true,
      institution: true,
      major: true,
      points: true,
      streak: true,
      _count: {
        select: {
          tasks: true,
          timerSessions: true,
          threads: true,
        },
      },
    },
  })

  // Compute badges for each user
  const ranked = users.map((user, idx) => ({
    ...user,
    rank: idx + 1,
    badges: computeBadges(user.points, user.streak, user._count.timerSessions, user._count.tasks),
    isCurrentUser: user.id === session.user.id,
  }))

  return NextResponse.json(ranked)
}

function computeBadges(
  points: number,
  streak: number,
  timerSessions: number,
  tasks: number
): string[] {
  const badges: string[] = []
  if (points >= 1000) badges.push('🏆 Master')
  else if (points >= 500) badges.push('💎 Expert')
  else if (points >= 200) badges.push('🥇 Advanced')
  else if (points >= 50) badges.push('🥈 Intermediate')
  else if (points > 0) badges.push('🥉 Beginner')

  if (streak >= 30) badges.push('🔥 Streak Legend')
  else if (streak >= 7) badges.push('⚡ Consistent')

  if (timerSessions >= 50) badges.push('⏱️ Focus Master')
  else if (timerSessions >= 10) badges.push('⏱️ Focused')

  if (tasks >= 50) badges.push('✅ Task Champion')
  else if (tasks >= 10) badges.push('✅ Productive')

  return badges
}
