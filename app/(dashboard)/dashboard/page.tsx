import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ConnectCardButton } from '@/components/cards/ConnectCardButton'
import { RefreshButton } from '@/components/cards/RefreshButton'
import { AddManualCardButton } from '@/components/cards/AddManualCardButton'
import {
  formatCurrency,
  getDueDateStatus,
  formatRelativeTime,
  monthlyEquivalent,
} from '@/lib/utils'
import { getInstitutionInfo } from '@/lib/institutions'
import { sortCardsForDisplay } from '@/lib/cards'
import { PayCardButton } from '@/components/cards/PayCardButton'
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'
import { RemoveCardButton } from '@/components/cards/RemoveCardButton'
import { EditManualCardButton } from '@/components/cards/EditManualCardButton'
import { BalancePie, type BalanceSlice } from '@/components/cards/BalancePie'
import { RecentTransactions } from '@/components/cards/RecentTransactions'
import { RecurringCharges } from '@/components/cards/RecurringCharges'
import { BeforeStatementCloses } from '@/components/cards/BeforeStatementCloses'
import { ImportCsvButton } from '@/components/cards/ImportCsvButton'
import { MarkViewed } from '@/components/cards/MarkViewed'
import { AutoRefresh } from '@/components/cards/AutoRefresh'
import { EnableTransactionsButton } from '@/components/cards/EnableTransactionsButton'
import { CardTile } from '@/components/cards/CardTile'
import { CardFocusManager } from '@/components/cards/CardFocusManager'

// Card identity colors, validated for CVD separation in both themes.
// Referenced as CSS vars so they re-step when the theme flips.
const CARD_COLORS = [
  'var(--s1)',
  'var(--s2)',
  'var(--s3)',
  'var(--s4)',
  'var(--s5)',
  'var(--s6)',
]

export default async function DashboardPage() {
  const { userId } = await auth()

  const [
    { data: cards },
    { data: transactions },
    { data: connections },
    { data: recurring },
    { data: userState },
  ] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select('*, connected_accounts(institution_name, institution_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('transactions')
      .select(
        'id, card_id, name, merchant_name, amount, transaction_date, pending, category, created_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('connected_accounts')
      .select('id, institution_name, transactions_enabled')
      .eq('user_id', userId),
    supabaseAdmin
      .from('recurring_charges')
      .select(
        'id, card_id, description, merchant_name, frequency, average_amount, last_amount, predicted_next_date, status'
      )
      .eq('user_id', userId)
      .eq('is_active', true),
    supabaseAdmin
      .from('user_state')
      .select('last_viewed_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const allCards = cards ?? []
  const allTransactions = transactions ?? []
  const allRecurring = recurring ?? []
  // Read before MarkViewed writes, so the "new" markers survive this render.
  const lastViewedAt = userState?.last_viewed_at ?? null

  // Only prompt for connections that actually hold cards. A connection with
  // none is an orphan — a dead sandbox link, or a bank that was re-connected
  // and left a stale row behind. It can never sync, so it would ask for consent
  // forever and fail every time.
  const connectionsWithCards = new Set(
    allCards.map((c) => c.connected_account_id).filter(Boolean)
  )
  const needsTransactionsConsent = (connections ?? []).filter(
    (c) => !c.transactions_enabled && connectionsWithCards.has(c.id)
  )

  const colorById: Record<string, string> = {}
  const cardNameById: Record<string, string> = {}
  allCards.forEach((c, i) => {
    colorById[c.id] = CARD_COLORS[i % CARD_COLORS.length]
    cardNameById[c.id] = c.name
  })

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBalance = allCards.reduce((s, c) => s + (c.balance_current ?? 0), 0)
  const cardsWithStatement = allCards.filter((c) => c.statement_balance != null)
  const totalStatement = cardsWithStatement.reduce(
    (s, c) => s + (c.statement_balance ?? 0),
    0
  )
  const totalLimit = allCards
    .filter((c) => c.balance_limit != null)
    .reduce((s, c) => s + (c.balance_limit ?? 0), 0)
  const overallUtilization =
    totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : null

  const overdueCount = allCards.filter((c) => {
    if (!c.due_date || c.minimum_payment === 0) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'overdue'
  }).length
  const dueSoonCount = allCards.filter((c) => {
    if (!c.due_date) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'due-soon'
  }).length

  const syncTimes = allCards
    .map((c) => c.last_synced_at)
    .filter((t): t is string => Boolean(t))
    .sort()
  const lastSyncedAt = syncTimes.length ? syncTimes[syncTimes.length - 1] : null

  const pieSlices: BalanceSlice[] = allCards.map((c) => ({
    id: c.id,
    name: c.name,
    balance: c.balance_current ?? 0,
    limit: c.balance_limit,
    color: colorById[c.id],
  }))

  const recurringMonthly = allRecurring.reduce(
    (s, c) => s + monthlyEquivalent(c.average_amount ?? 0, c.frequency),
    0
  )

  const newSinceCount = lastViewedAt
    ? allTransactions.filter(
        (t) => t.created_at && new Date(t.created_at) > new Date(lastViewedAt)
      ).length
    : 0

  if (allCards.length === 0) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center">
          <p className="text-sm text-ink-2">No cards yet.</p>
          <p className="mt-1 text-xs text-ink-3">
            Connect a card through Plaid or add one manually.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <AddManualCardButton />
            <ConnectCardButton />
          </div>
        </div>
      </div>
    )
  }

  // Highest utilization first, so whatever needs attention is at the top.
  // Sorts render order only — colorById is keyed off the original creation
  // order, so a card keeps its color as balances move.
  const sortedCards = sortCardsForDisplay(allCards)

  const cardList = sortedCards.map((card) => {
    const institution = card.connected_accounts as {
      institution_name: string
      institution_id: string
    } | null
    const institutionName =
      institution?.institution_name ?? card.institution_name ?? 'Credit card'
    const info = getInstitutionInfo(institutionName)
    const isManual = card.source === 'manual'

    return (
      <CardTile
        key={card.id}
        accent={colorById[card.id]}
        card={{
          id: card.id,
          name: card.name,
          institutionName,
          mask: card.mask,
          isManual,
          balance_current: card.balance_current,
          balance_available: card.balance_available,
          balance_limit: card.balance_limit,
          statement_balance: card.statement_balance,
          statement_date: card.statement_date,
          minimum_payment: card.minimum_payment,
          due_date: card.due_date,
        }}
        limitControl={
          isManual ? undefined : (
            <ManualLimitInput cardId={card.id} currentLimit={card.balance_limit} />
          )
        }
        actions={
          <>
            {info && (
              <PayCardButton
                webUrl={info.webUrl}
                appScheme={info.appScheme}
                accentColor={colorById[card.id]}
              />
            )}
            {isManual && (
              <EditManualCardButton
                cardId={card.id}
                cardName={card.name}
                currentInstitution={card.institution_name ?? null}
                currentBalance={card.balance_current}
                currentLimit={card.balance_limit}
                currentDueDate={card.due_date}
                currentMinPayment={card.minimum_payment}
              />
            )}
            <RemoveCardButton cardId={card.id} cardName={card.name} />
          </>
        }
      />
    )
  })

  return (
    <>
      {/*
        One composed page. Regions are separated by whitespace and a single
        quiet label each — no boxes, no rules carving the page into cells.
        Nothing scrolls except a list that genuinely outgrows its space.
      */}
      <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-x-12 gap-y-8">

        {/* ── Left: the numbers ─────────────────────────────────────────── */}
        <aside className="flex flex-col min-h-0">
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

          <div className="mt-8">
            <BalancePie slices={pieSlices} />
          </div>

          <div className="mt-9 flex flex-col min-h-0">
            <p className="label mb-1">Pay before close</p>
            <div className="scroll-y -mx-1 px-1">
              <BeforeStatementCloses cards={allCards} colorById={colorById} />
            </div>
          </div>
        </aside>

        {/* ── Right: the lists ──────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 gap-9">

          <div className="flex flex-col min-h-0 max-h-[46%]">
            <div className="flex items-center justify-between gap-4 mb-1">
              <p className="label">Your cards</p>
              <div className="flex items-center gap-1.5">
                {lastSyncedAt && (
                  <span className="text-[11px] text-ink-3 mr-1">
                    Updated {formatRelativeTime(new Date(lastSyncedAt))}
                  </span>
                )}
                <RefreshButton />
                <ImportCsvButton cards={allCards.map((c) => ({ id: c.id, name: c.name }))} />
                <AddManualCardButton />
                <ConnectCardButton />
              </div>
            </div>

            <div className="scroll-y -mx-1 px-1">
              {/* Listens for ring-chart clicks and isolates that card */}
              <CardFocusManager />
              {cardList}

              {needsTransactionsConsent.length > 0 && (
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="text-xs text-ink-2">
                    Turn on transactions to see every charge. Your cards and balances
                    stay exactly as they are.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {needsTransactionsConsent.map((c) => (
                      <EnableTransactionsButton
                        key={c.id}
                        connectionId={c.id}
                        institutionName={c.institution_name ?? 'this bank'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="flex flex-col min-h-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="label">Recent activity</p>
                {newSinceCount > 0 && (
                  <span className="text-[11px] font-medium text-s1">
                    {newSinceCount} new
                  </span>
                )}
              </div>
              <div className="scroll-y -mx-1 px-1">
                <RecentTransactions
                  transactions={allTransactions}
                  cardNameById={cardNameById}
                  colorById={colorById}
                  newSince={lastViewedAt}
                />
              </div>
            </div>

            <div className="flex flex-col min-h-0">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="label">Recurring</p>
                {allRecurring.length > 0 && (
                  <span className="sensitive-value text-[11px] text-ink-3 tnum">
                    {formatCurrency(recurringMonthly)}/mo
                  </span>
                )}
              </div>
              <div className="scroll-y -mx-1 px-1">
                <RecurringCharges
                  charges={allRecurring}
                  cardNameById={cardNameById}
                  colorById={colorById}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AutoRefresh lastSyncedAt={lastSyncedAt} />
      <MarkViewed />
    </>
  )
}
