import { Suspense } from 'react'
import AITutorPageClient from './AITutorPageClient'

function AITutorFallback() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="text-muted small">Memuat AI Tutor…</div>
    </div>
  )
}

export default function AITutorPage() {
  return (
    <Suspense fallback={<AITutorFallback />}>
      <AITutorPageClient />
    </Suspense>
  )
}
