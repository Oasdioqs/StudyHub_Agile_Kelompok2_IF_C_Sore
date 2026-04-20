import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const runtimeDbUrl =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) ||
  (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) ||
  undefined

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(runtimeDbUrl ? { datasources: { db: { url: runtimeDbUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
