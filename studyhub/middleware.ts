// middleware.ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tasks/:path*',
    '/notes/:path*',
    '/forum/:path*',
    '/ai-tutor/:path*',
    '/timer/:path*',
    '/profile/:path*',
  ],
}
