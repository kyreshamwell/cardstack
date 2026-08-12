'use client'
// components/cards/CardTile.tsx
//
// One credit card, as a flat row with a utilization ring.
//
//   Face      — ring (utilization), name, mask, due, statement balance
//   Expanded  — current balance, available, limit, minimum, close date, actions
//
// The ring is colored by card IDENTITY, matching the ring chart and its legend.
// It deliberately does NOT switch to severity colors: the same visual form
// would then mean identity in one place on the screen and severity in another.
// How full the ring is already carries magnitude, and "Before statement closes"
// calls out the cards that actually need paying down.
//
// No border. Rows are divided by hairlines, like every other list.

import { useState, type ReactNode } from 'react'
import {
  formatCurrency,
  calcUtilization,
  getDueDateStatus,
  nextStatementClose,
  daysUntil,
} from '@/lib/utils'

export interface CardTileData {
  id: string
  name: string
  institutionName: string
  mask: string | null
  isManual: boolean
  balance_current: number | null
  balance_available: number | null
  balance_limit: number | null
  statement_balance: number | null
  statement_date: string | null
  minimum_payment: number | null
  due_date: string | null
}

interface Props {
  card: CardTileData
  accent: string
  actions?: ReactNode
  limitControl?: ReactNode
}

const RING = 42
const R = 18
const CIRC = 2 * Math.PI * R

export function CardTile({ card, accent, actions, limitControl }: Props) {
  const [open, setOpen] = useState(false)

  const utilization =
    card.balance_current != null && card.balance_limit
      ? calcUtilization(card.balance_current, card.balance_limit)
      : null

  const available =
    card.balance_available ??
    (card.balance_limit != null && card.balance_current != null
      ? card.balance_limit - card.balance_current
      : null)

  const dueDate = card.due_date ? new Date(`${card.due_date}T12:00:00`) : null
  const dueStatus = dueDate ? getDueDateStatus(dueDate) : null
  const daysToDue = dueDate ? daysUntil(dueDate) : null
  const closes = nextStatementClose(card.statement_date)

  const headline = card.statement_balance ?? card.balance_current
  const headlineIsStatement = card.statement_balance != null

  // A $0 minimum means nothing is actually due — no red.
  const showOverdue = dueStatus === 'overdue' && card.minimum_payment !== 0

  const filled = utilization != null ? Math.max(0, Math.min(utilization, 100)) : 0

  return (
    <div data-card-id={card.id} className="border-t border-line first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left flex items-center gap-3 px-1 py-2.5 hover:bg-raised transition-colors"
      >
        <div className="relative shrink-0" style={{ width: RING, height: RING }}>
          <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="var(--line)"
              strokeWidth={3.5}
            />
            {utilization != null && (
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke={accent}
                strokeWidth={3.5}
                strokeDasharray={`${(CIRC * filled) / 100} ${CIRC}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            )}
          </svg>
          <span className="sensitive-value absolute inset-0 grid place-items-center text-[10px] font-semibold tnum">
            {utilization != null ? `${utilization}%` : '—'}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{card.name}</p>
          <p className="mt-0.5 text-[11px] text-ink-3 truncate tnum">
            {card.mask ? `···· ${card.mask}` : card.isManual ? 'Manual' : card.institutionName}
            {daysToDue != null && (
              <>
                {' · '}
                <span
                  className={
                    showOverdue
                      ? 'text-critical font-medium'
                      : daysToDue <= 7
                      ? 'text-warning font-medium'
                      : ''
                  }
                >
                  {showOverdue
                    ? 'overdue'
                    : daysToDue === 0
                    ? 'due today'
                    : daysToDue === 1
                    ? 'due tomorrow'
                    : `due in ${daysToDue}d`}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="sensitive-value text-[15px] font-semibold tracking-tight leading-none">
            {headline != null ? formatCurrency(headline) : '—'}
          </p>
          <p className="mt-1 text-[10px] text-ink-3">
            {headlineIsStatement ? 'statement' : 'current'}
          </p>
        </div>

        <svg
          className={`h-3 w-3 text-ink-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="pb-3 pl-[54px] pr-1 space-y-1.5">
          <Row label="Current balance">
            <span className="sensitive-value tnum">
              {card.balance_current != null ? formatCurrency(card.balance_current) : '—'}
            </span>
          </Row>
          <Row label="Available">
            <span className="sensitive-value tnum">
              {available != null ? formatCurrency(available) : '—'}
            </span>
          </Row>
          <Row label="Credit limit">
            {limitControl ?? (
              <span className="sensitive-value tnum">
                {card.balance_limit != null ? formatCurrency(card.balance_limit) : '—'}
              </span>
            )}
          </Row>
          {card.minimum_payment != null && (
            <Row label="Minimum payment">
              <span className="sensitive-value tnum">
                {formatCurrency(card.minimum_payment)}
              </span>
            </Row>
          )}
          {closes && (
            <Row label="Statement closes">
              <span className="tnum">
                {closes.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </Row>
          )}

          {actions && (
            <div className="pt-2 flex items-center gap-2 flex-wrap">{actions}</div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-2">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  )
}
