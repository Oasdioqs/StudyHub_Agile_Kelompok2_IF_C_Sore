// app/dashboard/layout.tsx - shared by all app pages
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  )
}
