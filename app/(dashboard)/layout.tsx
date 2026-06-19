import Link from 'next/link'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { NavUserButton } from '@/components/NavUserButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center">
            <span className="text-xs font-bold text-white">CS</span>
          </div>
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Cardstack
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <PrivacyToggle />
          <NavUserButton />
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
