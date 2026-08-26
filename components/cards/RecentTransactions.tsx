// components/cards/RecentTransactions.tsx
//
// Server component. Renders the transaction list inside its panel. The panel
// supplies the heading and the "N new" count; this is just the body.
//
// Sign convention comes straight from Plaid: POSITIVE amounts are money out
// (a purchase, which increases what you owe), NEGATIVE amounts are money in
// (a payment or refund). Payments show in green with a minus sign because they
// reduce the balance.

import { formatCurrency } from '@/lib/utils'

export interface TransactionRow {
  id: string
  card_id: string | null
  name: string
  merchant_name: string | null
  amount: number
  transaction_date: string
  pending: boolean
  category: string | null
  created_at: string | null
}

interface Props {
  transactions: TransactionRow[]
  cardNameById: Record<string, string>
  colorById: Record<string, string>
  /** Anything stored after this timestamp is new to the user. */
  newSince: string | null
}

export function RecentTransactions({
  transactions,
  cardNameById,
  colorById,
  newSince,
}: Props) {
  if (transactions.length === 0) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div>
          <p className="text-xs text-ink-2">No transactions yet.</p>
          <p className="mt-1 text-xs text-ink-3">
            Turn on transactions for a card to see charges here.
          </p>
        </div>
      </div>
    )
  }

  // Compared against created_at (when we stored it), not transaction_date. A
  // charge dated last week that only synced today is still new to you.
  const cutoff = newSince ? new Date(newSince).getTime() : null
  const isNew = (tx: TransactionRow) =>
    cutoff != null && tx.created_at != null && new Date(tx.created_at).getTime() > cutoff

  return (
    <div>
      {transactions.map((tx, i) => {
        const isCredit = tx.amount < 0
        const cardName = tx.card_id ? cardNameById[tx.card_id] : null
        const accent = tx.card_id ? colorById[tx.card_id] : undefined
        const date = new Date(`${tx.transaction_date}T12:00:00`)

        return (
          <div
            key={tx.id}
            className={`relative flex items-center gap-3 pl-4 pr-1 py-2.5 ${
              i > 0 ? 'border-t border-line' : ''
            }`}
          >
            {isNew(tx) && (
              <span
                title="New since you last looked"
                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-s1"
              />
            )}
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: accent ?? 'var(--ink-3)' }}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">
                {tx.merchant_name ?? tx.name}
                {tx.pending && (
                  <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3 align-middle">
                    Pending
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-3 truncate">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {cardName && ` · ${cardName}`}
                {tx.category && ` · ${formatCategory(tx.category)}`}
              </p>
            </div>

            <span
              className={`sensitive-value shrink-0 text-xs font-semibold tnum ${
                isCredit ? 'text-good' : ''
              }`}
            >
              {isCredit ? '−' : ''}
              {formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Plaid returns categories as SCREAMING_SNAKE_CASE, e.g. FOOD_AND_DRINK
function formatCategory(raw: string): string {
  return raw
    .toLowerCase()
    .split('_')
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}
