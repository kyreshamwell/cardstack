'use client'

import { DonutChart, type ChartSlice } from '@/components/cards/DonutChart'
import { CardFocusManager } from '@/components/cards/CardFocusManager'
import { PrivacyToggle } from '@/components/cards/PrivacyToggle'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { PayCardButton } from '@/components/cards/PayCardButton'
import { formatCurrency, calcUtilization, getDueDateStatus } from '@/lib/utils'
import { getInstitutionInfo } from '@/lib/institutions'

const CARD_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4']

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000)

const DEMO_CARDS = [
  {
    id: 'demo-1',
    bank: 'Capital One',
    name: 'Quicksilver',
    mask: '4823',
    balance: 1240,
    limit: 5000,
    minPayment: 35,
    dueDate: daysFromNow(5), // due-soon
  },
  {
    id: 'demo-2',
    bank: 'Chase',
    name: 'Sapphire Preferred',
    mask: '9141',
    balance: 3400,
    limit: 8500,
    minPayment: 85,
    dueDate: daysFromNow(20), // upcoming
  },
  {
    id: 'demo-3',
    bank: 'Synchrony Bank',
    name: 'Amazon Prime Card',
    mask: '2267',
    balance: 290,
    limit: 2000,
    minPayment: 25,
    dueDate: daysFromNow(25), // upcoming
  },
]

export function DemoDashboard() {
  const totalBalance = DEMO_CARDS.reduce((s, c) => s + c.balance, 0)

  const chartSlices: ChartSlice[] = DEMO_CARDS.map((c, i) => ({
    id: c.id,
    name: `${c.bank} ${c.name}`,
    balance: c.balance,
    color: CARD_COLORS[i % CARD_COLORS.length],
  }))

  const dueDateBadge = {
    overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
    'due-soon': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    upcoming: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live demo — try it below, no sign-up needed
        </div>
        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <PrivacyToggle />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Balance breakdown — real DonutChart, click a slice or legend row to isolate a card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
            Balance breakdown
          </p>
          <DonutChart slices={chartSlices} totalBalance={totalBalance} />
        </div>

        <div>
          <CardFocusManager />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_CARDS.map((card, i) => {
              const utilization = calcUtilization(card.balance, card.limit)
              const available = card.limit - card.balance
              const dueDateStatus = getDueDateStatus(card.dueDate)
              const dueDateLabel =
                dueDateStatus === 'overdue' ? 'Overdue'
                : dueDateStatus === 'due-soon' ? 'Due soon'
                : `Due ${card.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

              const institutionInfo = getInstitutionInfo(card.bank)
              const accentColor = CARD_COLORS[i % CARD_COLORS.length]

              return (
                <div
                  key={card.id}
                  id={`card-${card.id}`}
                  data-card-id={card.id}
                  className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-700/40"
                >
                  <div className="h-1" style={{ backgroundColor: accentColor }} />
                  <div className="bg-gradient-to-br from-slate-900 to-black dark:from-black dark:to-slate-950 px-5 pt-4 pb-5">
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{card.bank}</p>
                    <p className="mt-0.5 text-base font-semibold text-white leading-tight">{card.name}</p>

                    <div className="mt-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Current balance</p>
                      <p className="sensitive-value mt-0.5 text-3xl font-bold text-white tabular-nums">
                        {formatCurrency(card.balance)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="font-mono text-sm tracking-widest text-slate-500">•••• {card.mask}</p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${dueDateBadge[dueDateStatus]}`}>
                        {dueDateLabel}
                      </span>
                    </div>

                    <div className="mt-3 h-1 w-full rounded-full bg-white/10">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${Math.min(utilization, 100)}%`, backgroundColor: accentColor }}
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 px-5 py-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Available</span>
                      <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(available)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Credit limit</span>
                      <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(card.limit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                      <span className="sensitive-value text-sm font-semibold" style={{ color: accentColor }}>
                        {utilization}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Min. payment</span>
                      <span className="sensitive-value text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(card.minPayment)}
                      </span>
                    </div>
                    {institutionInfo && (
                      <PayCardButton
                        webUrl={institutionInfo.webUrl}
                        appScheme={institutionInfo.appScheme}
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

      <p className="mt-6 text-center text-xs text-slate-500">
        This is sample data — sign up to connect your real cards.
      </p>
    </div>
  )
}
