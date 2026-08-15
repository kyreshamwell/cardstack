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

import { useEffect, useRef, useState } from 'react'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'
import { PieCenter } from '@/components/charts/pie-center'
import { chartCenterValueClassName } from '@/components/charts/chart-center-typography'
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
  /**
   * Diameter in px. Sized by the caller because the space differs a lot: it
   * sits in a 320px rail on desktop and gets the full width of a phone.
   */
  size?: number
}

const DEFAULT_SIZE = 180

function focusCard(id: string, name: string) {
  window.dispatchEvent(new CustomEvent('card:focus', { detail: { id, name } }))
}

export function BalancePie({ slices, size = DEFAULT_SIZE }: Props) {
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
  //
  // That alone made the chart completely dead to touch: a tap produces no
  // hover, so `hoveredIndex` was still null when the click arrived and nothing
  // happened. It also meant a click that somehow beat its own hover event did
  // nothing on desktop.
  //
  // The fallback resolves the row from the event target instead. `legend-row`
  // is a marker class on LegendItem — a class we already pass, so the vendored
  // component doesn't have to be forked to get a per-row hit target.
  const legendRef = useRef<HTMLDivElement>(null)

  function indexFromEvent(e: React.MouseEvent): number | null {
    const rows = legendRef.current?.querySelectorAll('.legend-row')
    if (!rows) return null
    const row = (e.target as Element | null)?.closest?.('.legend-row')
    if (!row) return null
    const i = Array.prototype.indexOf.call(rows, row)
    return i >= 0 ? i : null
  }

  function handleClick(e: React.MouseEvent) {
    const index = hoveredIndex ?? indexFromEvent(e)
    if (index == null) return
    const slice = withBalance[index]
    if (slice) focusCard(slice.id, slice.name)
  }

  return (
    <div className="flex flex-col items-center" onClick={handleClick}>
      {mounted ? (
        <PieChart
          data={pieData}
          hoveredIndex={hoveredIndex}
          innerRadius={Math.round(size * 0.305)}
          onHoverChange={setHoveredIndex}
          size={size}
        >
          {pieData.map((_, i) => (
            <PieSlice index={i} key={i} />
          ))}
          {/*
            Privacy mode is CSS on `.sensitive-value`, so anything rendering a
            figure has to opt in by name. The center value gets it via
            valueClassName rather than className — className is the container,
            which would blur the "Total balance" label too, and a label isn't
            the secret. Passing valueClassName replaces the default outright,
            so the vendored default has to be re-included, not appended to.
          */}
          <PieCenter
            defaultLabel="Total balance"
            prefix="$"
            valueClassName={`${chartCenterValueClassName} sensitive-value`}
          />
        </PieChart>
      ) : (
        <div style={{ width: size, height: size }} aria-hidden="true" />
      )}

      <div className="mt-4 w-full" ref={legendRef}>
        <Legend
          hoveredIndex={hoveredIndex}
          items={legendItems}
          onHoverChange={setHoveredIndex}
        >
          <LegendItem className="legend-row flex items-center gap-2.5 px-0 py-1.5">
            <LegendMarker />
            <LegendLabel className="text-xs font-medium flex-1 min-w-0 truncate" />
            {/*
              Here className IS the right hook: LegendValue puts it on the span
              wrapping both the amount and the utilization percentage, and the
              blur filter inherits down to both. Utilization is as revealing as
              the balance — CardTile already blurs its ring percentage.
            */}
            <LegendValue
              className="sensitive-value text-xs tabular-nums text-ink-2"
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
