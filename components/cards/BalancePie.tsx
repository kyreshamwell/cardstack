'use client'
// components/cards/BalancePie.tsx
//
// Balance by card, using Bklit's PieChart. Installed from their shadcn registry
// (`npx shadcn@latest add @bklit/pie-chart @bklit/legend`), so components/charts
// holds their real source rather than a reimplementation.
//
// Note what a pie can and can't say. It's a part-to-whole form, so the wedges
// are each card's SHARE OF TOTAL BALANCE — "where is my debt concentrated",
// not "which card is near its limit". Utilization is the number that moves a
// credit score, so it rides along in the legend: passing each card's limit as
// maxValue makes the legend's percentage read as utilization, not share.

import { useEffect, useState } from 'react'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'
import { PieCenter } from '@/components/charts/pie-center'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
  LegendValue,
} from '@/components/charts/legend'
import { formatCurrency } from '@/lib/utils'

export interface BalanceSlice {
  id: string
  name: string
  balance: number
  limit: number | null
  color: string
}

interface Props {
  slices: BalanceSlice[]
}

const SIZE = 180

function focusCard(id: string, name: string) {
  window.dispatchEvent(new CustomEvent('card:focus', { detail: { id, name } }))
}

export function BalancePie({ slices }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // The center value animates through NumberFlow, a custom element that doesn't
  // exist until the client defines it — so server and client HTML disagree and
  // React throws a hydration error. Rendering the chart only after mount avoids
  // the mismatch entirely; the placeholder holds the same footprint so nothing
  // shifts when it appears.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Cards carrying no balance would be zero-width wedges — invisible, but still
  // consuming a color slot and a legend row.
  const withBalance = slices.filter((s) => s.balance > 0)

  if (withBalance.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-ink-3">No balances to chart yet.</p>
    )
  }

  const pieData = withBalance.map((s) => ({
    label: s.name,
    value: s.balance,
    color: s.color,
  }))

  const legendItems = withBalance.map((s) => ({
    label: s.name,
    value: s.balance,
    // maxValue drives the legend percentage — limit, so it reads as utilization.
    maxValue: s.limit ?? undefined,
    color: s.color,
  }))

  // LegendItem exposes hover but not click, and the chart drives the same
  // hoveredIndex — so a click anywhere here resolves to whatever the pointer
  // is currently over, slice or row.
  function handleClick() {
    if (hoveredIndex == null) return
    const slice = withBalance[hoveredIndex]
    if (slice) focusCard(slice.id, slice.name)
  }

  return (
    <div className="flex flex-col items-center" onClick={handleClick}>
      {mounted ? (
        <PieChart
          data={pieData}
          hoveredIndex={hoveredIndex}
          innerRadius={55}
          onHoverChange={setHoveredIndex}
          size={SIZE}
        >
          {pieData.map((_, i) => (
            <PieSlice index={i} key={i} />
          ))}
          <PieCenter defaultLabel="Total balance" prefix="$" />
        </PieChart>
      ) : (
        <div style={{ width: SIZE, height: SIZE }} aria-hidden="true" />
      )}

      <div className="mt-4 w-full">
        <Legend
          hoveredIndex={hoveredIndex}
          items={legendItems}
          onHoverChange={setHoveredIndex}
        >
          <LegendItem className="flex items-center gap-2.5 px-0 py-1.5">
            <LegendMarker />
            <LegendLabel className="text-xs font-medium flex-1 min-w-0 truncate" />
            <LegendValue
              className="text-xs tabular-nums text-ink-2"
              formatValue={formatCurrency}
              percentageClassName="text-xs tabular-nums font-semibold ml-2"
              showPercentage
            />
          </LegendItem>
        </Legend>
      </div>
    </div>
  )
}
