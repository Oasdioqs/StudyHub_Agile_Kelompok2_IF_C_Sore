import { Suspense } from 'react'
import TasksPageClient from './TasksPageClient'

function TasksFallback() {
  return (
    <div className="d-flex align-items-center justify-content-center p-5">
      <div className="text-muted small">Memuat tugas…</div>
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
