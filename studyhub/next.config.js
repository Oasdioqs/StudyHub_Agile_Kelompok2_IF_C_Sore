
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS: force HTTPS for 1 year, including subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'unzipper'],
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
    return [{ source: '/:path*', headers: securityHeaders }]
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
      disableLogger: true,
    })
  }
} catch {
  // @sentry/nextjs not installed yet, skip
}

module.exports = exportedConfig
