import { Suspense } from 'react'
import TasksPageClient from './TasksPageClient'

function TasksFallback() {
  return (
    <div className="animate-fade-up" style={{ maxWidth: 640 }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <div className="skeleton skeleton-title mb-2" style={{ width: 160 }} />
          <div className="skeleton skeleton-text" style={{ width: 220 }} />
        </div>
        <div className="skeleton skeleton-btn" style={{ width: 120 }} />
      </div>
      <div className="d-flex gap-2 mb-4">
        {[80, 100, 90].map((w, i) => (
          <div key={i} className="skeleton skeleton-badge" style={{ width: w }} />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-3 mb-2 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="d-flex align-items-start gap-3">
            <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text mb-2" style={{ width: `${60 + i * 8}%` }} />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
            <div className="skeleton skeleton-badge" style={{ width: 56 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksFallback />}>
      <TasksPageClient />
    </Suspense>
  )
}
