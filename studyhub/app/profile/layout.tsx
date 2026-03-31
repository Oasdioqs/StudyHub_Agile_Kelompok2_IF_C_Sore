import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition">{children}</main>
      </div>
    </div>
  )
}
