'use client'
// components/dashboard/AppShell.tsx
//
// The fixed-viewport chrome: a fixed-height nav row, and a main that takes
// exactly the space left over. The page itself never scrolls; panels inside
// scroll on their own. `min-h-0` on main is what allows that; without it the
// flex child refuses to shrink below its content and the whole page scrolls.
//
// Extracted from the dashboard layout so both the demo and the landing page
// wear the same frame rather than a lookalike. That shared frame is what lets
// the landing page become the demo in place: the nav never unmounts, so only
// the body has to animate.

import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Right-hand nav cluster. Real app: theme + privacy + account. Demo: theme + privacy + exit. */
  navRight: ReactNode
  /** Where the brand mark links. The landing and demo point at `/`. */
  brandHref?: string
}

// Fixed viewport on desktop, ordinary document scrolling on phones.
//
// `h-dvh` + `overflow-hidden` is the right model on a laptop, where the
// promise is that the dashboard fits one screen. On a phone it forces every
// list into an inner scroll box, so content stops at that box's edge partway
// down the screen instead of at the bottom of the display, and iOS never
// collapses its address bar because the document itself never scrolls. Below
// `xl` the shell simply grows and the page scrolls like a page.
export function AppShell({ children, navRight, brandHref = '/dashboard' }: Props) {
  return (
    <div className="min-h-dvh xl:h-dvh flex flex-col bg-ground text-ink xl:overflow-hidden">
      <nav
        className="flex-none border-b border-line bg-ground px-4 py-2.5 flex items-center justify-between gap-4"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
      >
        <Link href={brandHref} className="flex items-center gap-2.5 min-w-0">
          <span className="h-6 w-6 rounded-md bg-ink text-ground grid place-items-center text-[10px] font-bold shrink-0">
            CS
          </span>
          {/* Mark only on phones. The wordmark is the first thing that can go
              when the nav's actions need the width more than the brand does. */}
          <span className="hidden sm:inline text-sm font-semibold tracking-tight truncate">
            Cardstack
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">{navRight}</div>
      </nav>

      {/* `flex-1` in a `min-h-dvh` column means main fills whatever the nav
          leaves and grows past it when content is taller, with no calc
          guessing at the chrome height, which is variable anyway once iOS
          safe-area insets are in play. */}
      {/* A flex column below xl so its child can claim the leftover height
          with `flex-1`. A percentage `h-full` doesn't reliably resolve against
          a parent whose own height came from flex-grow, which left the landing
          hero collapsed to its content at the top of a much taller screen. */}
      <main className="safe-bottom flex flex-1 flex-col p-3 xl:block xl:min-h-0">
        {children}
      </main>
    </div>
  )
}
