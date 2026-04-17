import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { isDevPremium } from './dev-premium'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email.trim().toLowerCase()

        const user = await db.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user?.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (existing && !existing.emailVerified) {
          await db.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          })
        }
      }
      return true
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      // Dev override: always checked on every token refresh
      const emailForCheck = (token.email as string | null)
      const isDevUser = isDevPremium(emailForCheck)
      if (isDevUser) {
        token.isPremium = true
        token.isDeveloper = true
      } else if (user || trigger === 'update') {
        token.isDeveloper = false
        try {
          const dbUser = await db.user.findUnique({
            where: { id: (token.id as string) },
            select: { isPremium: true },
          })
          token.isPremium = dbUser?.isPremium ?? false
        } catch {
          token.isPremium = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.isPremium = token.isPremium ?? false
        session.user.isDeveloper = token.isDeveloper ?? false
      }
      return session
    },
  },
}
