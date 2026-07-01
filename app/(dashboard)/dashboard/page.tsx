import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ConnectCardButton } from '@/components/cards/ConnectCardButton'
import { RefreshButton } from '@/components/cards/RefreshButton'
import { AddManualCardButton } from '@/components/cards/AddManualCardButton'
import { formatCurrency, calcUtilization, getDueDateStatus } from '@/lib/utils'
import { getInstitutionInfo } from '@/lib/institutions'
import { PayCardButton } from '@/components/cards/PayCardButton'
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'
import { RemoveCardButton } from '@/components/cards/RemoveCardButton'
import { EditManualCardButton } from '@/components/cards/EditManualCardButton'
import { CardFocusManager } from '@/components/cards/CardFocusManager'
import { DonutChart, type ChartSlice } from '@/components/cards/DonutChart'

const CARD_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
]

export default async function DashboardPage() {
  const { userId } = await auth()

  const { data: cards } = await supabaseAdmin
    .from('cards')
    .select('*, connected_accounts(institution_name, institution_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const allCards = cards ?? []

  const totalBalance = allCards.reduce((s, c) => s + (c.balance_current ?? 0), 0)
  const totalLimit = allCards
    .filter((c) => c.balance_limit != null)
    .reduce((s, c) => s + (c.balance_limit ?? 0), 0)
  const overallUtilization =
    totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : null
  const overdueCount = allCards.filter((c) => {
    if (!c.due_date) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'overdue'
  }).length
  const dueSoonCount = allCards.filter((c) => {
    if (!c.due_date) return false
    return getDueDateStatus(new Date(`${c.due_date}T12:00:00`)) === 'due-soon'
  }).length

  const chartSlices: ChartSlice[] = allCards
    .filter((c) => c.balance_current != null && c.balance_current > 0)
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      balance: c.balance_current,
      color: CARD_COLORS[i % CARD_COLORS.length],
    }))

  const colorById: Record<string, string> = {}
  allCards.forEach((c, i) => {
    colorById[c.id] = CARD_COLORS[i % CARD_COLORS.length]
  })

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Your Cards</h1>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <AddManualCardButton />
          <ConnectCardButton />
        </div>
      </div>

      {allCards.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-slate-500 dark:text-slate-400">No cards connected yet.</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            Connect a card via Plaid or add one manually.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex gap-6 items-start">

          {/* ── Left panel ── */}
          <div className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
                Balance breakdown
              </p>
              {totalBalance > 0 ? (
                <DonutChart slices={chartSlices} totalBalance={totalBalance} />
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No balance data yet</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
                Overview
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total balance</span>
                  <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total limit</span>
                  <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {totalLimit > 0 ? formatCurrency(totalLimit) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                  <span className={`sensitive-value text-sm font-semibold ${
                    overallUtilization == null ? 'text-slate-900 dark:text-slate-100'
                    : overallUtilization >= 30 ? 'text-yellow-600'
                    : 'text-emerald-600'
                  }`}>
                    {overallUtilization != null ? `${overallUtilization}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Alerts</span>
                  <span className="text-sm font-semibold">
                    {overdueCount > 0 ? (
                      <span className="text-red-500">{overdueCount} overdue</span>
                    ) : dueSoonCount > 0 ? (
                      <span className="text-yellow-500">{dueSoonCount} due soon</span>
                    ) : (
                      <span className="text-emerald-500">All clear</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Cards</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {allCards.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: mobile summary + cards ── */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 gap-3 mb-5 lg:hidden">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Balance</p>
                <p className="sensitive-value mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Utilization</p>
                <p className={`sensitive-value mt-1 text-lg font-bold ${
                  overallUtilization == null ? 'text-slate-900 dark:text-slate-100'
                  : overallUtilization >= 30 ? 'text-yellow-600'
                  : 'text-emerald-600'
                }`}>
                  {overallUtilization != null ? `${overallUtilization}%` : '—'}
                </p>
              </div>
            </div>

            {/* Cards grid */}
            <CardFocusManager />
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {allCards.map((card) => {
                const accentColor = colorById[card.id]
                const utilization =
                  card.balance_current != null && card.balance_limit != null
                    ? calcUtilization(card.balance_current, card.balance_limit)
                    : null

                const availableCredit =
                  card.balance_available ??
                  (card.balance_limit != null && card.balance_current != null
                    ? card.balance_limit - card.balance_current
                    : null)

                const dueDate = card.due_date ? new Date(`${card.due_date}T12:00:00`) : null
                const dueDateStatus = dueDate ? getDueDateStatus(dueDate) : null

                const institution = card.connected_accounts as {
                  institution_name: string
                  institution_id: string
                } | null

                const institutionName =
                  institution?.institution_name ?? card.institution_name ?? 'Credit Card'
                const institutionInfo = institution
                  ? getInstitutionInfo(institution.institution_name)
                  : null
                const payUrl = institutionInfo?.webUrl ?? null
                const appLink = institutionInfo?.appLink ?? null
                const isManual = card.source === 'manual'

                const dueDateBadge = {
                  overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
                  'due-soon': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
                  upcoming: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
                }

                const dueDateLabel =
                  dueDateStatus === 'overdue' ? 'Overdue'
                  : dueDateStatus === 'due-soon' ? 'Due soon'
                  : dueDate
                  ? `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : null

                return (
                  <div
                    key={card.id}
                    id={`card-${card.id}`}
                    data-card-id={card.id}
                    className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-700/40"
                  >
                    {/* Accent bar */}
                    <div className="h-1" style={{ backgroundColor: accentColor }} />

                    {/* Dark header — deeper gradient in both modes */}
                    <div className="bg-gradient-to-br from-slate-900 to-black dark:from-black dark:to-slate-950 px-5 pt-4 pb-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                            {institutionName}
                          </p>
                          <p className="mt-0.5 text-base font-semibold text-white leading-tight">
                            {card.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
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
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Current balance</p>
                        <p className="sensitive-value mt-0.5 text-3xl font-bold text-white tabular-nums">
                          {card.balance_current != null ? formatCurrency(card.balance_current) : '—'}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="font-mono text-sm tracking-widest text-slate-500">
                          {card.mask ? `•••• ${card.mask}` : isManual ? 'Manual' : ''}
                        </p>
                        {dueDate && dueDateStatus && dueDateLabel && !(dueDateStatus === 'overdue' && card.minimum_payment === 0) && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dueDateBadge[dueDateStatus]}`}>
                            {dueDateLabel}
                          </span>
                        )}
                      </div>

                      {utilization != null && (
                        <div className="mt-3 h-1 w-full rounded-full bg-white/10">
                          <div
                            className="h-1 rounded-full transition-all"
                            style={{ width: `${Math.min(utilization, 100)}%`, backgroundColor: accentColor }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Stats — light in light mode, dark in dark mode */}
                    <div className="bg-white dark:bg-slate-900 px-5 py-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Available</span>
                        <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {availableCredit != null ? formatCurrency(availableCredit) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Credit limit</span>
                        {isManual ? (
                          <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {card.balance_limit != null ? formatCurrency(card.balance_limit) : '—'}
                          </span>
                        ) : (
                          <ManualLimitInput cardId={card.id} currentLimit={card.balance_limit} />
                        )}
                      </div>
                      {utilization != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                          <span className="sensitive-value text-sm font-semibold" style={{ color: accentColor }}>
                            {utilization}%
                          </span>
                        </div>
                      )}
                      {card.minimum_payment != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Min. payment</span>
                          <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(card.minimum_payment)}
                          </span>
                        </div>
                      )}
                      {payUrl && (
                        <PayCardButton
                          webUrl={payUrl}
                          appLink={appLink}
                          accentColor={accentColor}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
