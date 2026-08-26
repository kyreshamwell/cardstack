// components/cards/RecurringCharges.tsx
//
// Server component. Renders the recurring streams Plaid detected.
//
// The headline is the normalized monthly total, since that's the number that
// answers "what am I paying every month without thinking about it." Individual
// charges keep their real cadence in the subtitle so nothing is misrepresented.

import { formatCurrency, monthlyEquivalent, formatFrequency } from '@/lib/utils'

export interface RecurringRow {
  id: string
  card_id: string | null
  description: string
  merchant_name: string | null
  frequency: string | null
  average_amount: number | null
  last_amount: number | null
  predicted_next_date: string | null
  status: string | null
}

interface Props {
  charges: RecurringRow[]
  cardNameById: Record<string, string>
  colorById: Record<string, string>
}

export function RecurringCharges({ charges, cardNameById, colorById }: Props) {
  if (charges.length === 0) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div>
          <p className="text-xs text-ink-2">No recurring charges detected yet.</p>
          <p className="mt-1 text-xs text-ink-3">
            Plaid needs a couple of billing cycles to spot a pattern.
          </p>
        </div>
      </div>
    )
  }

  // Biggest first, so the ones worth cancelling are at the top.
  const sorted = [...charges].sort(
    (a, b) =>
      monthlyEquivalent(b.average_amount ?? 0, b.frequency) -
      monthlyEquivalent(a.average_amount ?? 0, a.frequency)
  )

  return (
    <div>
      {sorted.map((c, i) => {
          const cardName = c.card_id ? cardNameById[c.card_id] : null
          const accent = c.card_id ? colorById[c.card_id] : undefined
          const perMonth = monthlyEquivalent(c.average_amount ?? 0, c.frequency)
          const isMonthly = c.frequency === 'MONTHLY' || c.frequency == null

          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i > 0 ? 'border-t border-line' : ''
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: accent ?? 'var(--ink-3)' }}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">
                  {c.merchant_name ?? c.description}
                  {c.status === 'EARLY_DETECTION' && (
                    <span
                      title="Plaid has only seen this a couple of times, so it may not actually be recurring."
                      className="ml-2 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3 align-middle"
                    >
                      Unconfirmed
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3 truncate">
                  {formatFrequency(c.frequency)}
                  {cardName && ` · ${cardName}`}
                  {c.predicted_next_date &&
                    ` · next ${new Date(
                      `${c.predicted_next_date}T12:00:00`
                    ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="sensitive-value text-xs font-semibold tnum">
                  {formatCurrency(c.average_amount ?? 0)}
                </p>
                {/* Only show the conversion when it differs from the charge itself */}
                {!isMonthly && (
                  <p className="sensitive-value mt-0.5 text-[11px] text-ink-3 tnum">
                    {formatCurrency(perMonth)}/mo
                  </p>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
