// app/(dashboard)/dashboard/page.tsx
//
// Server Component — runs on the server, reads from Supabase directly.
// No sensitive data ever touches the browser.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ConnectCardButton } from '@/components/cards/ConnectCardButton'
import { RefreshButton } from '@/components/cards/RefreshButton'
import { formatCurrency, calcUtilization, getDueDateStatus } from '@/lib/utils'
import { getPaymentUrl } from '@/lib/institutions'

export default async function DashboardPage() {
  const { userId } = await auth()

  // Join cards with connected_accounts to get institution info for pay links
  const { data: cards } = await supabaseAdmin
    .from('cards')
    .select('*, connected_accounts(institution_name, institution_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your Cards</h1>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <ConnectCardButton />
        </div>
      </div>

      {!cards || cards.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-slate-500">No cards connected yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Click "Connect a card" to link your first credit card via Plaid.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const utilization = calcUtilization(card.balance_current ?? 0, card.balance_limit ?? 0)
            const dueDate = card.due_date ? new Date(card.due_date) : null
            const dueDateStatus = dueDate ? getDueDateStatus(dueDate) : null

            const institution = card.connected_accounts as {
              institution_name: string
              institution_id: string
            } | null

            const payUrl = institution
              ? getPaymentUrl(institution.institution_id, institution.institution_name)
              : null

            const dueDateStyles = {
              overdue:  'bg-red-50 text-red-700 border-red-200',
              'due-soon': 'bg-yellow-50 text-yellow-700 border-yellow-200',
              upcoming: 'bg-slate-50 text-slate-600 border-slate-200',
            }

            const dueDateLabels = {
              overdue: 'Overdue',
              'due-soon': 'Due soon',
              upcoming: 'Upcoming',
            }

            return (
              <div
                key={card.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col"
              >
                {/* Card name + last 4 */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{card.name}</p>
                    {card.mask && (
                      <p className="text-sm text-slate-400">•••• {card.mask}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      utilization >= 70
                        ? 'bg-red-100 text-red-700'
                        : utilization >= 30
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {utilization}% used
                  </span>
                </div>

                {/* Balances */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Balance</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(card.balance_current ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Available</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(card.balance_available ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Limit</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(card.balance_limit ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      utilization >= 70
                        ? 'bg-red-500'
                        : utilization >= 30
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>

                {/* Due date + minimum payment */}
                {dueDate && dueDateStatus ? (
                  <div className={`mt-4 rounded-lg border px-3 py-2.5 ${dueDateStyles[dueDateStatus]}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                          {dueDateLabels[dueDateStatus]}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">
                          {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {card.minimum_payment != null && (
                        <div className="text-right">
                          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                            Min. payment
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {formatCurrency(card.minimum_payment)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">Due date unavailable</p>
                )}

                {/* Pay link */}
                {payUrl && (
                  <a
                    href={payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block rounded-lg border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Pay this card →
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
