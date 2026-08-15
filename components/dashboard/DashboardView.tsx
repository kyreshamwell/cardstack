'use client'
// components/dashboard/DashboardView.tsx
//
// The dashboard itself — every pixel of it, and no data fetching.
//
// This used to live inline in app/(dashboard)/dashboard/page.tsx, which meant
// the demo on the landing page had to be a separate lookalike. It drifted, of
// course: the demo was still on the old slate palette months after the redesign
// and showed a layout the app no longer had.
//
// Splitting the view from the query fixes that at the root. The real page
// queries Supabase and passes rows in; the demo passes fixtures in. Both render
// THIS component, so the demo cannot fall behind the app — and if the dashboard
// breaks, /demo breaks with it, in public, where Playwright can see it without
// credentials.
//
// The seams are the ReactNode props. Everything that needs a network — the
// toolbar buttons, per-card actions, the limit editor — is injected rather than
// imported, because those are exactly the things the demo has to replace.

import { useEffect, useState, type ReactNode } from 'react'
import {
  formatCurrency,
  getDueDateStatus,
  formatRelativeTime,
  monthlyEquivalent,
} from '@/lib/utils'
import { sortCardsForDisplay } from '@/lib/cards'
import { BalancePie, type BalanceSlice } from '@/components/cards/BalancePie'
import { CardTile, type CardTileData } from '@/components/cards/CardTile'
import { CardFocusManager } from '@/components/cards/CardFocusManager'
import { RecentTransactions, type TransactionRow } from '@/components/cards/RecentTransactions'
import { RecurringCharges, type RecurringRow } from '@/components/cards/RecurringCharges'
import { BeforeStatementCloses } from '@/components/cards/BeforeStatementCloses'

type Tab = 'cards' | 'activity' | 'insights'

const TABS: { key: Tab; label: string }[] = [
  { key: 'cards', label: 'Cards' },
  { key: 'activity', label: 'Activity' },
  { key: 'insights', label: 'Insights' },
]

/**
 * True below the `xl` breakpoint, where the desktop grid stops working.
 *
 * Starts false so server and first client render agree — a phone therefore
 * paints the desktop layout for one frame before switching. The alternative is
 * rendering both trees and hiding one in CSS, which mounts two of every chart
 * and list and duplicates `data-card-id` across the document.
 */
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return narrow
}

/** Everything the view needs about a card. A superset of CardTileData. */
export interface DashboardCard extends CardTileData {
  last_synced_at?: string | null
}

export interface DashboardViewProps {
  cards: DashboardCard[]
  transactions: TransactionRow[]
  recurring: RecurringRow[]
  /** Card id → identity color. Keyed off creation order, not display order. */
  colorById: Record<string, string>
  cardNameById: Record<string, string>
  /** Anything stored after this is "new since last visit". */
  lastViewedAt: string | null
  lastSyncedAt: string | null
  /** Refresh / Import / Add / Connect. */
  toolbar?: ReactNode
  /** Card id → the buttons on that card's expanded row. */
  actionsById?: Record<string, ReactNode>
  /** Card id → a limit editor replacing the plain limit figure. */
  limitControlById?: Record<string, ReactNode>
  /** Appended under the card list — consent prompts in the app, a nudge in the demo. */
  belowCards?: ReactNode
  /** Rendered when the user has no cards at all. */
  emptyState?: ReactNode
  /**
   * Shows the short explanations under section labels.
   *
   * On for the demo, off for the real dashboard. The demo is a teaching
   * surface — someone lands on it knowing nothing about the product, so the
   * one genuinely non-obvious idea in it (utilization reports at statement
   * close, not at the due date) has to be stated. On your own dashboard you
   * already know, and a permanent explainer is clutter you can't dismiss.
   */
  explain?: boolean
}

export function DashboardView({
  cards,
  transactions,
  recurring,
  colorById,
  cardNameById,
  lastViewedAt,
  lastSyncedAt,
  toolbar,
  actionsById,
  limitControlById,
  belowCards,
  emptyState,
  explain = false,
}: DashboardViewProps) {
  const isNarrow = useIsNarrow()
  const [tab, setTab] = useState<Tab>('cards')

  // On the phone layout the chart lives in Insights and the rows live in Cards,
  // so isolating a card has to bring you to the rows or it appears to do
  // nothing at all. Harmless on desktop, where both are already on screen.
  useEffect(() => {
    if (!isNarrow) return
    const toCards = () => setTab('cards')
    window.addEventListener('card:focus', toCards)
    return () => window.removeEventListener('card:focus', toCards)
  }, [isNarrow])

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBalance = cards.reduce((s, c) => s + (c.balance_current ?? 0), 0)
  const cardsWithStatement = cards.filter((c) => c.statement_balance != null)
  const totalStatement = cardsWithStatement.reduce(
    (s, c) => s + (c.statement_balance ?? 0),
    0
  )
  const totalLimit = cards
    .filter((c) => c.balance_limit != null)
    .reduce((s, c) => s + (c.balance_limit ?? 0), 0)

  const overdueCount = cards.filter((c) => {
    if (!c.due_date || c.minimum_payment === 0) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'overdue'
  }).length
  const dueSoonCount = cards.filter((c) => {
    if (!c.due_date) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'due-soon'
  }).length

  const pieSlices: BalanceSlice[] = cards.map((c) => ({
    id: c.id,
    name: c.name,
    balance: c.balance_current ?? 0,
    limit: c.balance_limit,
    color: colorById[c.id],
  }))

  const recurringMonthly = recurring.reduce(
    (s, c) => s + monthlyEquivalent(c.average_amount ?? 0, c.frequency),
    0
  )

  const newSinceCount = lastViewedAt
    ? transactions.filter(
        (t) => t.created_at && new Date(t.created_at) > new Date(lastViewedAt)
      ).length
    : 0

  if (cards.length === 0) return <>{emptyState}</>

  // Highest utilization first, so whatever needs attention is at the top.
  // Sorts render order only — colorById is keyed off the original creation
  // order, so a card keeps its color as balances move.
  const sortedCards = sortCardsForDisplay(cards)

  // ── Regions ───────────────────────────────────────────────────────────────
  //
  // Built once as values, then placed by whichever layout is active. Rendering
  // both layouts and hiding one with CSS would mount two of everything — two
  // charts, two transaction lists, duplicate `data-card-id` nodes — so only one
  // tree is ever in the DOM.

  const syncedLine = lastSyncedAt ? `Updated ${formatRelativeTime(new Date(lastSyncedAt))}` : null

  const headline = (
    <div>
      <p className="label">
        {cardsWithStatement.length > 0 ? 'Statement balance' : 'Current balance'}
      </p>
      <p className="sensitive-value mt-2 text-[42px] font-semibold tracking-tight leading-none">
        {formatCurrency(cardsWithStatement.length > 0 ? totalStatement : totalBalance)}
      </p>
      <p className="mt-2.5 text-xs text-ink-2">
        {cardsWithStatement.length > 0 ? (
          <>
            <span className="sensitive-value">{formatCurrency(totalBalance)}</span> current
            {' · '}
          </>
        ) : null}
        <span className="sensitive-value">{formatCurrency(totalLimit)}</span> limit
        {overdueCount > 0 ? (
          <span className="text-critical font-medium"> · {overdueCount} overdue</span>
        ) : dueSoonCount > 0 ? (
          <span className="text-warning font-medium"> · {dueSoonCount} due soon</span>
        ) : null}
      </p>
      {/* On phones the sync time moves up here. It's a fact about the whole
          account, not about the card list, and down in the Cards tab it was
          taking a slot the toolbar needed. */}
      {isNarrow && syncedLine && (
        <p className="mt-1.5 text-[11px] text-ink-3">{syncedLine}</p>
      )}
    </div>
  )

  const utilization = (
    <>
      {/*
        Named for the outcome, not the mechanic. "Pay before close" said when to
        act but never what for, and the figure underneath it was read as a bill
        — it sits alongside a minimum payment and a statement balance for the
        same card, and nothing distinguished it from either.
      */}
      <p className={`label ${explain ? '' : 'mb-1'}`}>Lower reported utilization</p>
      {explain && (
        <p className="mt-1 mb-1.5 text-[11px] leading-snug text-ink-3">
          Utilization reports when a statement closes, not when payment is due.
        </p>
      )}
      <div className="scroll-y -mx-1 px-1">
        <BeforeStatementCloses cards={cards} colorById={colorById} />
      </div>
    </>
  )

  // The tab bar already says "Cards", so repeating it below costs a row and
  // says nothing. Same for "Recent activity". With the label and the sync time
  // both gone, the toolbar fits on one line instead of wrapping onto two —
  // three rows of chrome before the first card become one.
  const cardsHeader = isNarrow ? (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">{toolbar}</div>
  ) : (
    <div className="mb-1 flex items-center justify-between gap-4">
      <p className="label">Your cards</p>
      <div className="flex items-center gap-1.5">
        {syncedLine && <span className="text-[11px] text-ink-3 mr-1">{syncedLine}</span>}
        {toolbar}
      </div>
    </div>
  )

  const cardList = (
    <div className="scroll-y -mx-1 px-1">
      {sortedCards.map((card) => (
        <CardTile
          key={card.id}
          accent={colorById[card.id]}
          card={card}
          limitControl={limitControlById?.[card.id]}
          actions={actionsById?.[card.id]}
        />
      ))}
      {belowCards}
    </div>
  )

  const activityHeader = (
    <div className="flex items-baseline justify-between gap-3 mb-1">
      {/* Label hidden on phones — the tab is the label. The count isn't
          duplicated anywhere, so it stays. */}
      <p className={`label ${isNarrow ? 'sr-only' : ''}`}>Recent activity</p>
      {newSinceCount > 0 && (
        <span className={`text-[11px] font-medium text-s1 ${isNarrow ? 'ml-auto' : ''}`}>
          {newSinceCount} new
        </span>
      )}
    </div>
  )

  const activityList = (
    <div className="scroll-y -mx-1 px-1">
      <RecentTransactions
        transactions={transactions}
        cardNameById={cardNameById}
        colorById={colorById}
        newSince={lastViewedAt}
      />
    </div>
  )

  const recurringHeader = (
    <div className="flex items-baseline justify-between gap-3 mb-1">
      <p className="label">Recurring</p>
      {recurring.length > 0 && (
        <span className="sensitive-value text-[11px] text-ink-3 tnum">
          {formatCurrency(recurringMonthly)}/mo
        </span>
      )}
    </div>
  )

  const recurringList = (
    <div className="scroll-y -mx-1 px-1">
      <RecurringCharges charges={recurring} cardNameById={cardNameById} colorById={colorById} />
    </div>
  )

  // ── Phone: one region at a time ───────────────────────────────────────────
  //
  // The desktop model does not survive a small screen. Its regions are sized as
  // fractions of a fixed viewport, and at phone height those fractions collapse
  // — measured on a 375×812 viewport, one panel was 0px tall and another was
  // 37px holding 998px of content, with the labels overlapping the rows beneath
  // them. Four nested scrollers on a touch screen is also the exact thing that
  // eats a swipe you meant for the page.
  //
  // Tabs instead: one region at a time, and `flow-scroll` neutralises the inner
  // `.scroll-y` regions so nothing scrolls but the page.
  //
  // No scroll container at all — the DOCUMENT scrolls.
  //
  // This went through two worse versions: an inner panel with the balance and
  // tabs pinned outside it, then one full-height inner scroller. Both stopped
  // content at a box edge rather than at the bottom of the screen, and neither
  // lets iOS collapse its address bar, because Safari only does that for
  // document scroll. `flow-scroll` still neutralises the nested `.scroll-y`
  // regions inside.
  if (isNarrow) {
    return (
      <div className="flow-scroll">
        <CardFocusManager />

        <div className="pb-4">{headline}</div>

        {/*
          Sticky to the document now, so it pins to the top of the screen as
          the nav scrolls away — the switch stays reachable no matter how far
          down you are.

          No negative margin bleeding it into the shell's padding: the rows sit
          inside that padding too, so nothing passes through the outer edge for
          it to cover, and a bar wider than its container adds horizontal
          scroll — on a phone that means the view can be swiped sideways.
        */}
        <div className="sticky top-0 z-10 bg-ground py-2">
          <div className="flex gap-1 rounded-xl bg-raised p-1" role="tablist">
            {TABS.map((t) => (
              <button
                aria-selected={tab === t.key}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  tab === t.key ? 'bg-ground text-ink shadow-sm' : 'text-ink-3'
                }`}
                key={t.key}
                onClick={() => setTab(t.key)}
                role="tab"
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4">
          {tab === 'cards' && (
            <>
              {cardsHeader}
              {cardList}
            </>
          )}
          {tab === 'activity' && (
            <>
              {activityHeader}
              {activityList}
            </>
          )}
          {tab === 'insights' && (
            <>
              {/* Sized to the panel rather than the 320px desktop rail — at 180
                  it used barely half the width available to it here. */}
              <BalancePie size={240} slices={pieSlices} />
              <div className="mt-8">{utilization}</div>
              <div className="mt-8">
                {recurringHeader}
                {recurringList}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Desktop: everything at once ───────────────────────────────────────────
  return (
    <>
      {/* Always mounted, outside both layouts: it has to receive `card:focus`
          even while the card list is on an inactive tab. */}
      <CardFocusManager />

      {/*
        One composed page. Regions are separated by whitespace and a single
        quiet label each — no boxes, no rules carving the page into cells.
        Nothing scrolls except a list that genuinely outgrows its space.
      */}
      <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-x-12 gap-y-8">

        {/* ── Left: the numbers ─────────────────────────────────────────── */}
        <aside className="flex flex-col min-h-0">
          {headline}

          <div className="mt-8">
            <BalancePie slices={pieSlices} />
          </div>

          <div className="mt-9 flex flex-col min-h-0">{utilization}</div>
        </aside>

        {/* ── Right: the lists ──────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 gap-9">

          <div className="flex flex-col min-h-0 max-h-[46%]">
            {cardsHeader}
            {cardList}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="flex flex-col min-h-0">
              {activityHeader}
              {activityList}
            </div>

            <div className="flex flex-col min-h-0">
              {recurringHeader}
              {recurringList}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
