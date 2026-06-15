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
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'
import { RemoveCardButton } from '@/components/cards/RemoveCardButton'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'

export default async function DashboardPage() {
  const { userId } = await auth()

  const { data: cards } = await supabaseAdmin
    .from('cards')
    .select('*, connected_accounts(institution_name, institution_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your Cards</h1>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
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
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const hasUtilizationData = card.balance_current != null && card.balance_limit != null
            const utilization = hasUtilizationData
              ? calcUtilization(card.balance_current, card.balance_limit)
              : null

            const availableCredit = card.balance_available ??
              (card.balance_limit != null && card.balance_current != null
                ? card.balance_limit - card.balance_current
                : null)

            // Parse as local noon to avoid UTC timezone shift
            const dueDate = card.due_date
              ? new Date(`${card.due_date}T12:00:00`)
              : null
            const dueDateStatus = dueDate ? getDueDateStatus(dueDate) : null

            const institution = card.connected_accounts as {
              institution_name: string
              institution_id: string
            } | null

            const payUrl = institution
              ? getPaymentUrl(institution.institution_id, institution.institution_name)
              : null

            const dueDateColors = {
              overdue: { bar: 'bg-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
              'due-soon': { bar: 'bg-yellow-400', badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' },
              upcoming: { bar: 'bg-emerald-400', badge: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30' },
            }

            const dueDateLabels = {
              overdue: 'Overdue',
              'due-soon': 'Due soon',
              upcoming: dueDate
                ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Upcoming',
            }

            return (
              <div
                key={card.id}
                className="rounded-2xl overflow-hidden shadow-md border border-slate-200/60"
              >
                {/* ── Dark card header ── */}
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-5 pb-6">
                  {/* Top row: institution + trash */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                        {institution?.institution_name ?? 'Credit Card'}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-white leading-tight">
                        {card.name}
                      </p>
                    </div>
                    <RemoveCardButton cardId={card.id} cardName={card.name} />
                  </div>

                  {/* Balance — big and center-stage */}
                  <div className="mt-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Current balance</p>
                    <p className="sensitive-value mt-1 text-3xl font-bold text-white tabular-nums">
                      {card.balance_current != null
                        ? formatCurrency(card.balance_current)
                        : '—'}
                    </p>
                  </div>

                  {/* Card mask + due date badge */}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="font-mono text-sm tracking-widest text-slate-400">
                      {card.mask ? `•••• ${card.mask}` : ''}
                    </p>
                    {dueDate && dueDateStatus && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dueDateColors[dueDateStatus].badge}`}
                      >
                        {dueDateStatus === 'upcoming'
                          ? `Due ${dueDateLabels[dueDateStatus]}`
                          : dueDateLabels[dueDateStatus]}
                      </span>
                    )}
                  </div>

                  {/* Utilization bar at bottom of header */}
                  {utilization != null && (
                    <div className="mt-4 h-1 w-full rounded-full bg-white/10">
                      <div
                        className={`h-1 rounded-full transition-all ${
                          utilization >= 70
                            ? 'bg-red-400'
                            : utilization >= 30
                            ? 'bg-yellow-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* ── White stat section ── */}
                <div className="bg-white px-5 py-4 space-y-3">
                  {/* Available */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Available</span>
                    <span className="sensitive-value text-sm font-semibold text-slate-900">
                      {availableCredit != null ? formatCurrency(availableCredit) : '—'}
                    </span>
                  </div>

                  {/* Limit */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Credit limit</span>
                    {card.balance_limit != null ? (
                      <span className="sensitive-value text-sm font-semibold text-slate-900">
                        {formatCurrency(card.balance_limit)}
                      </span>
                    ) : (
                      <ManualLimitInput cardId={card.id} />
                    )}
                  </div>

                  {/* Utilization % — only when we have the data */}
                  {utilization != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Utilization</span>
                      <span
                        className={`sensitive-value text-sm font-semibold ${
                          utilization >= 70
                            ? 'text-red-600'
                            : utilization >= 30
                            ? 'text-yellow-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {utilization}%
                      </span>
                    </div>
                  )}

                  {/* Minimum payment */}
                  {card.minimum_payment != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Min. payment</span>
                      <span className="sensitive-value text-sm font-semibold text-slate-900">
                        {formatCurrency(card.minimum_payment)}
                      </span>
                    </div>
                  )}

                  {/* Pay button */}
                  {payUrl && (
                    <a
                      href={payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block w-full rounded-lg bg-slate-900 py-2 text-center text-sm font-medium text-white hover:bg-slate-700 transition-colors"
                    >
                      Pay this card →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
