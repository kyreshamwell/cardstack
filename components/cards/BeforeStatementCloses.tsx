// components/cards/BeforeStatementCloses.tsx
//
// Server component. Answers one question: what should I pay, and by when, so
// this card doesn't report high utilization to the bureaus?
//
// The key fact most people miss: utilization is reported at STATEMENT CLOSE,
// not at the due date. Paying by the due date avoids interest; paying before
// the statement closes is what keeps the reported number low. Those are usually
// three weeks apart.
//
// Cards already under target are omitted: this is a to-do list, not a report.

import {
  formatCurrency,
  calcUtilization,
  nextStatementClose,
  payoffToTarget,
  daysUntil,
} from '@/lib/utils'

const TARGET_PERCENT = 30

export interface StatementCard {
  id: string
  name: string
  balance_current: number | null
  balance_limit: number | null
  statement_date: string | null
}

interface Props {
  cards: StatementCard[]
  colorById: Record<string, string>
}

export function BeforeStatementCloses({ cards, colorById }: Props) {
  const actions = cards
    .map((card) => {
      if (card.balance_current == null || card.balance_limit == null) return null

      const utilization = calcUtilization(card.balance_current, card.balance_limit)
      if (utilization <= TARGET_PERCENT) return null

      const closes = nextStatementClose(card.statement_date)
      const payoff = payoffToTarget(
        card.balance_current,
        card.balance_limit,
        TARGET_PERCENT
      )
      if (payoff <= 0) return null

      return { card, utilization, closes, payoff }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    // Soonest close first; cards with no known close date sink to the bottom.
    .sort((a, b) => {
      if (!a.closes) return 1
      if (!b.closes) return -1
      return a.closes.getTime() - b.closes.getTime()
    })

  if (actions.length === 0) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div>
          <p className="text-xs text-ink-2">Every card reports under {TARGET_PERCENT}%.</p>
          <p className="mt-1 text-xs text-ink-3">Nothing worth paying down early.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {actions.map(({ card, utilization, closes, payoff }, i) => {
        const days = closes ? daysUntil(closes) : null
        const urgent = days != null && days <= 5

        return (
          <div
            key={card.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i > 0 ? 'border-t border-line' : ''
            }`}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: colorById[card.id] ?? 'var(--ink-3)' }}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="text-xs">
                Pay{' '}
                <span className="sensitive-value font-semibold tnum">
                  {formatCurrency(payoff)}
                </span>{' '}
                on <span className="font-medium">{card.name}</span>
              </p>
              {/*
                `77% → 30%` rather than `Currently 77%`. The old line said where
                the card is but never where the payment would land it, which is
                the only thing that explains what the figure above is for. It
                is not the minimum, and it is not the statement balance.
              */}
              <p className="mt-0.5 text-[11px] text-ink-3">
                <span className="sensitive-value tnum">
                  {utilization}% → {TARGET_PERCENT}%
                </span>
                {closes
                  ? ` · closes ${closes.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}`
                  : ' · close date unknown'}
              </p>
            </div>

            {days != null && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tnum ${
                  urgent ? 'bg-warning-wash text-warning' : 'bg-raised text-ink-3'
                }`}
              >
                {days === 1 ? '1 day' : `${days} days`}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
