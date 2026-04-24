
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Download-Options', value: 'noopen' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  // HSTS: force HTTPS for 1 year, including subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Remove server identification
  { key: 'Server', value: 'StudyHub-Secure' },
]

// Allowed origins for CORS (empty in production for API security)
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://127.0.0.1:3000']
  : ['https://studyhubs.my.id', 'https://www.studyhubs.my.id']

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'unzipper'],
    instrumentationHook: true,
  },
  // Exclude native binaries from webpack bundling — loaded at runtime by Node.js
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        '@napi-rs/canvas',
        '@napi-rs/canvas-linux-x64-gnu',
        '@napi-rs/canvas-linux-arm64-gnu',
        '@napi-rs/canvas-darwin-x64',
        '@napi-rs/canvas-darwin-arm64',
        'mammoth',
        'unzipper',
      ]
      // Remove debug info from bundle
      config.devtool = 'source-map'
    }
    return config
  },
  images: {
    // remotePatterns replaces deprecated `domains`
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

// Wrap with Sentry only when DSN is configured
let exportedConfig = nextConfig
try {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    const { withSentryConfig } = require('@sentry/nextjs')
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      widenClientFileUpload: true,
      hideSourceMaps: true,
    })
  }
} catch {
  // @sentry/nextjs not installed yet, skip
}

module.exports = exportedConfig
