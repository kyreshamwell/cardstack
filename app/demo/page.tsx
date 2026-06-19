import { formatCurrency, calcUtilization, getDueDateStatus } from '@/lib/utils'

// Hardcoded sample cards — no auth, no Supabase, purely presentational.
// Dates are set relative to a known future window so status badges show correctly.
const DEMO_CARDS = [
  {
    id: '1',
    name: 'Quicksilver',
    institution_name: 'Capital One',
    mask: '4823',
    source: 'plaid',
    balance_current: 1240,
    balance_available: 3760,
    balance_limit: 5000,
    due_date: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 5)
      return d.toISOString().split('T')[0]
    })(),
    minimum_payment: 35,
  },
  {
    id: '2',
    name: 'Sapphire Preferred',
    institution_name: 'Chase',
    mask: '9141',
    source: 'plaid',
    balance_current: 3400,
    balance_available: 5100,
    balance_limit: 8500,
    due_date: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 26)
      return d.toISOString().split('T')[0]
    })(),
    minimum_payment: 85,
  },
  {
    id: '3',
    name: 'Amazon Prime Card',
    institution_name: 'Synchrony Bank',
    mask: '2267',
    source: 'manual',
    balance_current: 290,
    balance_available: 1710,
    balance_limit: 2000,
    due_date: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 33)
      return d.toISOString().split('T')[0]
    })(),
    minimum_payment: 25,
  },
]

export default function DemoPage() {
  const totalBalance = DEMO_CARDS.reduce((s, c) => s + c.balance_current, 0)
  const totalLimit = DEMO_CARDS.reduce((s, c) => s + c.balance_limit, 0)
  const overallUtilization = Math.round((totalBalance / totalLimit) * 100)

  const dueSoonCount = DEMO_CARDS.filter((c) => {
    const d = new Date(`${c.due_date}T12:00:00`)
    return getDueDateStatus(d) === 'due-soon'
  }).length

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your Cards</h1>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total balance</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total limit</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totalLimit)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Overall utilization</p>
          <p className={`mt-1 text-xl font-bold ${overallUtilization >= 30 ? 'text-yellow-600' : 'text-emerald-600'}`}>
            {overallUtilization}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Alerts</p>
          <p className="mt-1 text-xl font-bold">
            {dueSoonCount > 0
              ? <span className="text-yellow-600">{dueSoonCount} due soon</span>
              : <span className="text-emerald-600">All clear</span>}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_CARDS.map((card) => {
          const utilization = calcUtilization(card.balance_current, card.balance_limit)
          const dueDate = new Date(`${card.due_date}T12:00:00`)
          const dueDateStatus = getDueDateStatus(dueDate)

          const dueDateColors = {
            overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
            'due-soon': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
            upcoming: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
          }

          const dueDateLabel = dueDateStatus === 'overdue'
            ? 'Overdue'
            : dueDateStatus === 'due-soon'
            ? 'Due soon'
            : `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

          return (
            <div key={card.id} className="rounded-2xl overflow-hidden shadow-md border border-slate-200/60">
              {/* Dark header */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-5 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                      {card.institution_name}
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-white">{card.name}</p>
                  </div>
                  {card.source === 'manual' && (
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-slate-400">
                      Manual
                    </span>
                  )}
                </div>
                <div className="mt-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Current balance</p>
                  <p className="mt-1 text-3xl font-bold text-white tabular-nums">
                    {formatCurrency(card.balance_current)}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-mono text-sm tracking-widest text-slate-400">
                    {card.mask ? `•••• ${card.mask}` : 'Manual'}
                  </p>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dueDateColors[dueDateStatus]}`}>
                    {dueDateLabel}
                  </span>
                </div>
                <div className="mt-4 h-1 w-full rounded-full bg-white/10">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      utilization >= 70 ? 'bg-red-400' : utilization >= 30 ? 'bg-yellow-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Available</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(card.balance_available)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Credit limit</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(card.balance_limit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Utilization</span>
                  <span className={`text-sm font-semibold ${
                    utilization >= 70 ? 'text-red-600' : utilization >= 30 ? 'text-yellow-600' : 'text-emerald-600'
                  }`}>
                    {utilization}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Min. payment</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(card.minimum_payment)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
