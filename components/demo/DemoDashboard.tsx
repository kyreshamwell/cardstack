'use client'
// components/demo/DemoDashboard.tsx
//
// The demo IS the dashboard: same DashboardView, fixture data instead of
// Supabase rows, gated buttons instead of network ones.
//
// Body only — no shell. MarketingFrame owns the AppShell, so the nav never
// unmounts when the landing page slides to this, which is what makes the change
// read as one frame moving rather than two pages swapping.
//
// Nothing here reimplements a panel. The previous demo was a parallel copy and
// spent months showing a layout and a palette the app had already replaced; a
// demo assembled from the real components can only be wrong if the app is.

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { getInstitutionInfo } from '@/lib/institutions'
import { DemoGate, GatedButton } from '@/components/demo/DemoGate'
import { buildDemoData, type DemoData } from '@/lib/demo-data'

// Matched to the real buttons rather than approximated — a toolbar that sits a
// pixel off is the tell that this isn't the actual app.
const ICON_BUTTON =
  'flex items-center justify-center w-8 h-8 rounded-lg border border-line bg-ground text-ink-2 hover:bg-raised hover:text-ink transition-colors'
const QUIET_BUTTON =
  'rounded-lg border border-line bg-ground px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors'
const SOLID_BUTTON =
  'rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-ground hover:opacity-90 transition-opacity'

/**
 * Per-card actions.
 *
 * "Pay this card" is a dead lookalike here, not the real PayCardButton. The
 * real one is an <a> to the bank's own site, and firing a sample visitor off to
 * chase.com from a fake Chase card is both confusing and not ours to do. It
 * renders identically — same colour, same size, same label — and does nothing.
 */
function demoActions(data: DemoData): Record<string, ReactNode> {
  const map: Record<string, ReactNode> = {}
  data.cards.forEach((card) => {
    const info = getInstitutionInfo(card.institutionName)
    map[card.id] = (
      <>
        {info && (
          <span
            aria-hidden="true"
            className="mt-1 block w-full cursor-default rounded-lg py-2 text-center text-sm font-medium text-white select-none"
            style={{ backgroundColor: data.colors[card.id] }}
          >
            Pay this card →
          </span>
        )}
        <GatedButton
          action="Removing a card"
          className="text-ink-3 hover:text-critical transition-colors"
          title="Remove card"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </GatedButton>
      </>
    )
  })
  return map
}

/**
 * @param now Timestamp the fixtures are built from. Supplied by the server
 *   render so the client hydrates against identical dates — see lib/demo-data.
 */
export function DemoDashboard({ now }: { now: number }) {
  const data = useMemo(() => buildDemoData(now), [now])

  return (
    <DemoGate>
      <DashboardView
        actionsById={demoActions(data)}
        belowCards={
          // Full-width block on phones, inline on desktop. As a narrow pill
          // under a full-width paragraph it read as an afterthought hanging off
          // the end of the list, where the other tabs finish cleanly on a row.
          <div className="mt-4 rounded-xl border border-line bg-raised p-4 xl:mt-4 xl:rounded-none xl:border-0 xl:border-t xl:bg-transparent xl:p-0 xl:pt-3">
            <p className="text-xs text-ink-2">
              Sample data — five cards, two weeks of activity. Everything on this
              screen is the real dashboard.
            </p>
            <Link
              className={`${QUIET_BUTTON} mt-3 block w-full text-center xl:mt-2.5 xl:inline-block xl:w-auto`}
              href="/sign-up"
            >
              Connect your own cards →
            </Link>
          </div>
        }
        cardNameById={data.cardNames}
        cards={data.cards}
        colorById={data.colors}
        explain
        lastSyncedAt={data.lastSynced}
        lastViewedAt={data.lastViewed}
        recurring={data.recurring}
        toolbar={
          <>
            <GatedButton action="Refreshing balances" className={ICON_BUTTON} title="Refresh">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </GatedButton>
            <GatedButton action="Importing a CSV" className={QUIET_BUTTON}>
              Import
            </GatedButton>
            <GatedButton action="Adding a card" className={QUIET_BUTTON}>
              Add card
            </GatedButton>
            <GatedButton action="Connecting a bank" className={SOLID_BUTTON}>
              Connect
            </GatedButton>
          </>
        }
        transactions={data.transactions}
      />
    </DemoGate>
  )
}
