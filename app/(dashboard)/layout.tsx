import Link from 'next/link'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { NavUserButton } from '@/components/NavUserButton'

// Fixed-viewport shell: the page itself never scrolls. The nav is a fixed-height
// row and main takes the remaining space, so panels inside can scroll on their
// own. min-h-0 on main is what allows that — without it the flex child refuses
// to shrink below its content and the whole page scrolls instead.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex flex-col bg-ground text-ink overflow-hidden">
      <nav
        className="flex-none border-b border-line px-4 py-2.5 flex items-center justify-between gap-4"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <span className="h-6 w-6 rounded-md bg-ink text-ground grid place-items-center text-[10px] font-bold shrink-0">
            CS
          </span>
          <span className="text-sm font-semibold tracking-tight truncate">Cardstack</span>
        </Link>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <PrivacyToggle />
          <NavUserButton />
        </div>
      </nav>

      <main className="flex-1 min-h-0 p-3">{children}</main>
    </div>
  )
}
