import type { NextRequest } from 'next/server'
import { postMobileLogin } from '@/lib/mobile-login-post'

export async function POST(req: NextRequest) {
  return postMobileLogin(req)
}
