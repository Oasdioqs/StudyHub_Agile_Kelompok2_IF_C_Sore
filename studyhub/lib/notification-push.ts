import { db } from '@/lib/db'
import { sendPushToTokens } from '@/lib/firebase-admin'

type NotificationPayload = {
  type: string
  title: string
  message: string
  link?: string | null
}

async function getTokensByUserIds(userIds: string[]) {
  if (userIds.length === 0) return []
  const rows = await db.fcmToken.findMany({
    where: { userId: { in: Array.from(new Set(userIds)) } },
    select: { token: true },
  })
  return Array.from(new Set(rows.map((r) => r.token)))
}

export async function createNotificationWithPush(
  userId: string,
  payload: NotificationPayload,
  pushUrl?: string,
) {
  const notification = await db.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    },
  })

  const tokens = await getTokensByUserIds([userId]).catch(() => [])
  if (tokens.length > 0) {
    await sendPushToTokens(tokens, {
      title: payload.title,
      body: payload.message,
      url: pushUrl ?? payload.link ?? '/',
    })
  }

  return notification
}

export async function createNotificationsWithPush(
  userIds: string[],
  payload: NotificationPayload,
  options?: { skipDuplicates?: boolean; pushUrl?: string },
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return { count: 0 }

  const result = await db.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    })),
    ...(options?.skipDuplicates ? { skipDuplicates: true } : {}),
  })

  const tokens = await getTokensByUserIds(uniqueUserIds).catch(() => [])
  if (tokens.length > 0) {
    await sendPushToTokens(tokens, {
      title: payload.title,
      body: payload.message,
      url: options?.pushUrl ?? payload.link ?? '/',
    })
  }

  return result
}
