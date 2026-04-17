import * as Sentry from '@sentry/nextjs'

// Only initialize if SENTRY_DSN is set
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Sample 10% of transactions in production to stay on free tier
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Capture 100% of errors
    replaysOnErrorSampleRate: 1.0,

    // Only replay 5% of sessions (saves quota)
    replaysSessionSampleRate: 0.05,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out common non-actionable errors
    beforeSend(event) {
      // Ignore network errors from user's connection
      if (event.exception?.values?.[0]?.type === 'NetworkError') return null
      // Ignore browser extension errors
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        f => f.filename?.includes('chrome-extension')
      )) return null
      return event
    },
  })
}
