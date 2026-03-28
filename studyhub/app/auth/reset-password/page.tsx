import { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '40vh' }}>
          <span className="text-muted small">Memuat…</span>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
