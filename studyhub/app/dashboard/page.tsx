// app/dashboard/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id

  // Fetch data server-side
  const [todayTasks, upcomingTasks, recentNotes, unreadNotifs] = await Promise.all([
    db.task.findMany({
      where: {
        userId,
        status: { not: 'DONE' },
        deadline: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
    db.task.findMany({
      where: {
        userId,
        status: { not: 'DONE' },
        deadline: { gte: new Date() },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
    db.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    db.notification.count({ where: { userId, isRead: false } }),
  ])

  const priorityColor: Record<string, string> = {
    HIGH: 'danger', MEDIUM: 'warning', LOW: 'success',
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="p-4">
          {/* Welcome banner */}
          <div className="card mb-4 border-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white' }}>
            <div className="card-body p-4">
              <h5 className="fw-bold mb-1">Halo, {session.user.name?.split(' ')[0]}! 👋</h5>
              <p className="mb-3 opacity-75" style={{ fontSize: 14 }}>
                Semangat belajar hari ini. Kamu punya {todayTasks.length} tugas untuk diselesaikan.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Link href="/tasks?action=new" className="btn btn-sm btn-light fw-semibold">
                  <i className="bi bi-plus-circle me-1"></i>Tambah Tugas
                </Link>
                <Link href="/notes?action=new" className="btn btn-sm btn-outline-light fw-semibold">
                  <i className="bi bi-journal-plus me-1"></i>Buat Catatan
                </Link>
                <Link href="/timer" className="btn btn-sm btn-outline-light fw-semibold">
                  <i className="bi bi-alarm me-1"></i>Mulai Timer
                </Link>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="row g-3 mb-4">
            {[
              { label: 'Tugas Hari Ini', value: todayTasks.length, icon: 'bi-check2-square', color: '#4f46e5' },
              { label: 'Total Tugas Aktif', value: upcomingTasks.length, icon: 'bi-list-task', color: '#0ea5e9' },
              { label: 'Catatan Dibuat', value: recentNotes.length, icon: 'bi-journal-text', color: '#10b981' },
              { label: 'Notifikasi Baru', value: unreadNotifs, icon: 'bi-bell', color: '#f59e0b' },
            ].map((stat) => (
              <div key={stat.label} className="col-6 col-md-3">
                <div className="card h-100">
                  <div className="card-body d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 44, height: 44, background: stat.color + '18' }}>
                      <i className={`bi ${stat.icon}`} style={{ fontSize: 20, color: stat.color }}></i>
                    </div>
                    <div>
                      <div className="fw-bold fs-4 lh-1">{stat.value}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{stat.label}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4">
            {/* Today's tasks */}
            <div className="col-12 col-md-6">
              <div className="card h-100">
                <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-calendar-check me-2 text-primary"></i>
                    Tugas Hari Ini
                  </h6>
                  <Link href="/tasks" className="btn btn-sm btn-outline-primary">Lihat Semua</Link>
                </div>
                <div className="card-body p-0">
                  {todayTasks.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-check-circle" style={{ fontSize: 32 }}></i>
                      <p className="mt-2 mb-0 small">Tidak ada tugas hari ini 🎉</p>
                    </div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {todayTasks.map((task) => (
                        <li key={task.id}
                          className="list-group-item d-flex align-items-center gap-2 py-3">
                          <i className="bi bi-circle text-muted flex-shrink-0"></i>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>
                              {task.title}
                            </div>
                            {task.subject && (
                              <span className="badge bg-light text-muted" style={{ fontSize: 11 }}>
                                {task.subject}
                              </span>
                            )}
                          </div>
                          <span className={`badge badge-${task.priority} flex-shrink-0`}
                            style={{ fontSize: 11 }}>
                            {task.priority}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Recent notes */}
            <div className="col-12 col-md-6">
              <div className="card h-100">
                <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                  <h6 className="mb-0 fw-bold">
                    <i className="bi bi-journal-text me-2 text-success"></i>
                    Catatan Terbaru
                  </h6>
                  <Link href="/notes" className="btn btn-sm btn-outline-success">Lihat Semua</Link>
                </div>
                <div className="card-body">
                  {recentNotes.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <i className="bi bi-journal-plus" style={{ fontSize: 32 }}></i>
                      <p className="mt-2 mb-0 small">Belum ada catatan</p>
                    </div>
                  ) : (
                    <div className="row g-2">
                      {recentNotes.map((note) => (
                        <div key={note.id} className="col-6">
                          <Link href={`/notes/${note.id}`} className="text-decoration-none">
                            <div className="card h-100 border"
                              style={{ background: '#fafaf8' }}>
                              <div className="card-body p-3">
                                <div className="fw-semibold text-truncate text-dark"
                                  style={{ fontSize: 13 }}>
                                  {note.title}
                                </div>
                                <div className="text-muted mt-1"
                                  style={{ fontSize: 11, display: '-webkit-box',
                                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden' }}>
                                  {note.content.replace(/[#*`]/g, '').slice(0, 80)}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="row g-3 mt-2">
            {[
              { href: '/forum', icon: 'bi-chat-dots', label: 'Forum Diskusi', color: '#f59e0b', desc: 'Tanya & jawab bersama' },
              { href: '/ai-tutor', icon: 'bi-robot', label: 'AI Tutor', color: '#4f46e5', desc: 'Tanya soal ke AI' },
              { href: '/timer', icon: 'bi-alarm', label: 'Pomodoro Timer', color: '#10b981', desc: 'Mulai sesi belajar' },
            ].map((item) => (
              <div key={item.href} className="col-12 col-md-4">
                <Link href={item.href} className="text-decoration-none">
                  <div className="card d-flex flex-row align-items-center gap-3 p-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 44, height: 44, background: item.color + '1a' }}>
                      <i className={`bi ${item.icon}`} style={{ fontSize: 20, color: item.color }}></i>
                    </div>
                    <div>
                      <div className="fw-semibold" style={{ fontSize: 14, color: '#1e293b' }}>{item.label}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{item.desc}</div>
                    </div>
                    <i className="bi bi-chevron-right text-muted ms-auto"></i>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
