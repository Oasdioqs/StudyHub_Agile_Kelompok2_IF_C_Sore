import { Suspense } from 'react'
import VerifyEmailClient from './VerifyEmailClient'

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '40vh' }}>
          <span className="text-muted small">Memuat…</span>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  )
}
