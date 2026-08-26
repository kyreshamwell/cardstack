// tests/demo-data.test.ts
//
// The demo's fixtures are not decoration. /demo is the only surface that
// renders the real dashboard without credentials, so it doubles as the widest
// end-to-end coverage in the project. That only holds while the fixtures keep
// exercising every branch the dashboard has.
//
// These tests pin the fixture's PURPOSE rather than its literal values. Editing
// a balance is fine; editing it so that no card is over the utilization target
// silently empties a whole section of the demo, and nothing else would notice.
//
// The determinism tests exist because of a real bug: these used to be
// module-level constants evaluated at import time, so the server computed them
// once when the module loaded and the browser computed them again at hydration.
// The dashboard rendered "Updated 12 min ago" from the server and "8 min ago"
// on the client, and React threw a hydration mismatch on every page load.

import { describe, expect, it } from 'vitest'
import { buildDemoData } from '@/lib/demo-data'
import { calcUtilization } from '@/lib/utils'
import { payoffToTarget } from '@/lib/utils'

/** A fixed instant, so nothing here depends on when the suite runs. */
const NOW = new Date('2026-08-14T15:00:00').getTime()

describe('buildDemoData: determinism', () => {
  it('is a pure function of `now`', () => {
    // The whole point of threading a timestamp through from the server render.
    // If this ever stops holding, hydration mismatches come back.
    expect(buildDemoData(NOW)).toEqual(buildDemoData(NOW))
  })

  it('moves with `now` rather than with the clock', () => {
    const aDayLater = buildDemoData(NOW + 24 * 3600_000)
    const today = buildDemoData(NOW)

    expect(aDayLater.cards[0].due_date).not.toBe(today.cards[0].due_date)
    expect(aDayLater.lastSynced).not.toBe(today.lastSynced)
  })

  it('builds dates in local time, not UTC', () => {
    // The components parse `${date}T12:00:00`, i.e. local noon. Building with
    // toISOString() would push a late-in-the-day render onto tomorrow and every
    // offset would land a day out.
    const late = new Date('2026-08-14T23:30:00').getTime()
    const { cards } = buildDemoData(late)
    const dueSoon = cards.find((c) => c.id === 'demo-sapphire')!

    const expected = new Date(late)
    expected.setDate(expected.getDate() + 4)
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(dueSoon.due_date).toBe(
      `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`
    )
  })
})

describe('buildDemoData: every branch of the dashboard stays exercised', () => {
  const data = buildDemoData(NOW)

  it('has a card over the utilization target, so that section has something to say', () => {
    const over = data.cards.filter((c) => {
      if (c.balance_current == null || !c.balance_limit) return false
      return calcUtilization(c.balance_current, c.balance_limit) > 30
    })

    expect(over.length).toBeGreaterThan(0)
    // And the payoff it suggests must be a real, positive amount.
    const card = over[0]
    expect(payoffToTarget(card.balance_current!, card.balance_limit!, 30)).toBeGreaterThan(0)
  })

  it('has a card with no reported limit, so utilization degrades gracefully', () => {
    expect(data.cards.some((c) => c.balance_limit == null)).toBe(true)
  })

  it('has a card at zero, so the sort has a bottom tier', () => {
    expect(data.cards.some((c) => c.balance_current === 0)).toBe(true)
  })

  it('has a manually added card as well as connected ones', () => {
    expect(data.cards.some((c) => c.isManual)).toBe(true)
    expect(data.cards.some((c) => !c.isManual)).toBe(true)
  })

  it('has both money out and money in, so credits render differently', () => {
    // Plaid's convention: POSITIVE is money out, NEGATIVE is money in.
    expect(data.transactions.some((t) => t.amount > 0)).toBe(true)
    expect(data.transactions.some((t) => t.amount < 0)).toBe(true)
  })

  it('has a pending transaction', () => {
    expect(data.transactions.some((t) => t.pending)).toBe(true)
  })

  it('has a non-monthly recurring charge, so normalisation is visible', () => {
    // The panel's entire job is ranking by monthly equivalent. With every
    // charge already monthly, that normalisation is never demonstrated.
    expect(data.recurring.some((r) => r.frequency !== 'MONTHLY')).toBe(true)
  })

  it('leaves some transactions inside the "new since last visit" window', () => {
    const cutoff = new Date(data.lastViewed).getTime()
    const fresh = data.transactions.filter(
      (t) => t.created_at && new Date(t.created_at).getTime() > cutoff
    )

    expect(fresh.length).toBeGreaterThan(0)
    // But not all of them, or the marker means nothing.
    expect(fresh.length).toBeLessThan(data.transactions.length)
  })
})

describe('buildDemoData: internal consistency', () => {
  const data = buildDemoData(NOW)

  it('gives every card a colour and a name', () => {
    for (const card of data.cards) {
      expect(data.colors[card.id]).toBeTruthy()
      expect(data.cardNames[card.id]).toBe(card.name)
    }
  })

  it('only references cards that exist', () => {
    const ids = new Set(data.cards.map((c) => c.id))

    for (const t of data.transactions) {
      if (t.card_id) expect(ids.has(t.card_id)).toBe(true)
    }
    for (const r of data.recurring) {
      if (r.card_id) expect(ids.has(r.card_id)).toBe(true)
    }
  })

  it('uses unique ids', () => {
    const ids = [
      ...data.cards.map((c) => c.id),
      ...data.transactions.map((t) => t.id),
      ...data.recurring.map((r) => r.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })
})
