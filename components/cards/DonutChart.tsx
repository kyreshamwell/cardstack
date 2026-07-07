'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export interface ChartSlice {
  id: string
  name: string
  balance: number
  color: string
}

interface Props {
  slices: ChartSlice[]
  totalBalance: number
}

const r = 58
const cx = 80
const cy = 80
const circumference = 2 * Math.PI * r
const GAP = 3

function focusCard(id: string, name: string) {
  window.dispatchEvent(new CustomEvent('card:focus', { detail: { id, name } }))
}

export function DonutChart({ slices, totalBalance }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  let accumulated = 0

  return (
    <div>
      {/* Chart */}
      <div className="relative mx-auto w-40 h-40">
        <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="18"
            className="stroke-slate-100 dark:stroke-slate-800" />

          {slices.map((slice) => {
            const segmentLength = (slice.balance / totalBalance) * circumference
            const visible = Math.max(segmentLength - GAP, 0)
            const dasharray = `${visible} ${circumference - visible}`
            const dashoffset = -accumulated
            accumulated += segmentLength

            const isHovered = hovered === slice.id
            const isDimmed = hovered !== null && !isHovered

            return (
              <circle
                key={slice.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={slice.color}
                strokeOpacity={isDimmed ? 0.2 : 1}
                strokeWidth={isHovered ? 22 : 18}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="butt"
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHovered(slice.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => focusCard(slice.id, slice.name)}
              />
            )
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none">
                {slices.find((s) => s.id === hovered)?.name.split(' ')[0]}
              </p>
              <p className="sensitive-value mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                {formatCurrency(slices.find((s) => s.id === hovered)?.balance ?? 0)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none">
                Total
              </p>
              <p className="sensitive-value mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                {formatCurrency(totalBalance)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 space-y-1">
        {slices.map((slice) => {
          const pct = Math.round((slice.balance / totalBalance) * 100)
          return (
            <div
              key={slice.id}
              onMouseEnter={() => setHovered(slice.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => focusCard(slice.id, slice.name)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors cursor-pointer ${
                hovered === slice.id ? 'bg-slate-50 dark:bg-slate-800' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{slice.name}</span>
              </div>
              <span className="sensitive-value ml-3 text-sm font-semibold text-slate-900 dark:text-slate-100 flex-shrink-0">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
