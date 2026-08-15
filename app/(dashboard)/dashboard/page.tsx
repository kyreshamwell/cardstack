import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { supabaseForUser } from '@/lib/supabase'
import { getInstitutionInfo } from '@/lib/institutions'
import { CARD_COLORS } from '@/lib/cards'
import { DashboardView, type DashboardCard } from '@/components/dashboard/DashboardView'
import { ConnectCardButton } from '@/components/cards/ConnectCardButton'
import { RefreshButton } from '@/components/cards/RefreshButton'
import { AddManualCardButton } from '@/components/cards/AddManualCardButton'
import { PayCardButton } from '@/components/cards/PayCardButton'
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'
import { RemoveCardButton } from '@/components/cards/RemoveCardButton'
import { EditManualCardButton } from '@/components/cards/EditManualCardButton'
import { ImportCsvButton } from '@/components/cards/ImportCsvButton'
import { MarkViewed } from '@/components/cards/MarkViewed'
import { AutoRefresh } from '@/components/cards/AutoRefresh'
import { EnableTransactionsButton } from '@/components/cards/EnableTransactionsButton'

// Queries Supabase, shapes rows into view props, and injects the buttons that
// need a network. The layout and arithmetic live in DashboardView, which the
// public demo renders too — so the demo cannot drift from the real thing.
//
// Every query below runs through supabaseForUser(), so Row Level Security is
// enforced in the database. The `.eq('user_id', …)` filters are kept as belt
// and braces — they narrow the query, but they are no longer what makes it
// safe. See lib/supabase.ts.
export default async function DashboardPage() {
  const { userId } = await auth()
  const db = supabaseForUser()

  const [
    { data: cards },
    { data: transactions },
    { data: connections },
    { data: recurring },
    { data: userState },
  ] = await Promise.all([
    db
      .from('cards')
      .select('*, connected_accounts(institution_name, institution_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    db
      .from('transactions')
      .select(
        'id, card_id, name, merchant_name, amount, transaction_date, pending, category, created_at'
      )
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(50),
    db
      .from('connected_accounts')
      .select('id, institution_name, transactions_enabled')
      .eq('user_id', userId),
    db
      .from('recurring_charges')
      .select(
        'id, card_id, description, merchant_name, frequency, average_amount, last_amount, predicted_next_date, status'
      )
      .eq('user_id', userId)
      .eq('is_active', true),
    db
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

  const syncTimes = allCards
    .map((c) => c.last_synced_at)
    .filter((t): t is string => Boolean(t))
    .sort()
  const lastSyncedAt = syncTimes.length ? syncTimes[syncTimes.length - 1] : null

  // Rows in, view props out. Everything below is shaping — the arithmetic and
  // the markup both live in DashboardView, which the public demo also renders.
  const viewCards: DashboardCard[] = allCards.map((card) => {
    const institution = card.connected_accounts as {
      institution_name: string
      institution_id: string
    } | null
    return {
      id: card.id,
      name: card.name,
      institutionName:
        institution?.institution_name ?? card.institution_name ?? 'Credit card',
      mask: card.mask,
      isManual: card.source === 'manual',
      balance_current: card.balance_current,
      balance_available: card.balance_available,
      balance_limit: card.balance_limit,
      statement_balance: card.statement_balance,
      statement_date: card.statement_date,
      minimum_payment: card.minimum_payment,
      due_date: card.due_date,
    }
  })

  const actionsById: Record<string, ReactNode> = {}
  const limitControlById: Record<string, ReactNode> = {}
  allCards.forEach((card) => {
    const institution = card.connected_accounts as {
      institution_name: string
    } | null
    const institutionName =
      institution?.institution_name ?? card.institution_name ?? 'Credit card'
    const info = getInstitutionInfo(institutionName)
    const isManual = card.source === 'manual'

    if (!isManual) {
      limitControlById[card.id] = (
        <ManualLimitInput cardId={card.id} currentLimit={card.balance_limit} />
      )
    }

    actionsById[card.id] = (
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
    )
  })

  return (
    <>
      <DashboardView
        actionsById={actionsById}
        belowCards={
          needsTransactionsConsent.length > 0 ? (
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
          ) : null
        }
        cardNameById={cardNameById}
        cards={viewCards}
        colorById={colorById}
        emptyState={
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
        }
        lastSyncedAt={lastSyncedAt}
        lastViewedAt={lastViewedAt}
        limitControlById={limitControlById}
        recurring={allRecurring}
        toolbar={
          <>
            <RefreshButton />
            <ImportCsvButton cards={allCards.map((c) => ({ id: c.id, name: c.name }))} />
            <AddManualCardButton />
            <ConnectCardButton />
          </>
        }
        transactions={allTransactions}
      />

      <AutoRefresh lastSyncedAt={lastSyncedAt} />
      <MarkViewed />
    </>
  )
}
