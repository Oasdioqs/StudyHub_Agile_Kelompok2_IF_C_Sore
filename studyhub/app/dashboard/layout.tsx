import Sidebar from '@/components/layout/Sidebar'
import TopbarShell from '@/components/layout/TopbarShell'
import { OnboardingGate } from '@/components/OnboardingGate'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  let onboardingDone = true

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingDone: true },
    }).catch(() => null)
    onboardingDone = user?.onboardingDone ?? true
  }

  return (
    <div>
      <Sidebar />
      <div className="app-main">
        <TopbarShell />
        <main className="p-4 page-transition">{children}</main>
      </div>
      <OnboardingGate onboardingDone={onboardingDone} />
    </div>
  )
}
