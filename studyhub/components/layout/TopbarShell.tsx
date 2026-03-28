'use client'

import { Suspense } from 'react'
import Topbar from './Topbar'

export function TopbarSkeleton() {
  return (
    <header
      className="topbar topbar-skeleton border-bottom d-flex align-items-center px-3 py-2 flex-shrink-0"
      style={{ minHeight: 52, background: 'var(--sh-card-bg, #fff)' }}
      aria-hidden="true"
    >
      <div className="placeholder-glow w-100 d-flex align-items-center gap-2">
        <span className="placeholder col-2 rounded" style={{ height: 28 }} />
        <span className="placeholder col-4 rounded ms-auto" style={{ height: 36, maxWidth: 280 }} />
      </div>
    </header>
  )
}

export default function TopbarShell() {
  return (
    <Suspense fallback={<TopbarSkeleton />}>
      <Topbar />
    </Suspense>
  )
}
