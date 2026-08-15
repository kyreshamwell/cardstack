// tests/cards.test.ts
//
// Display order and the sync rule that protects a manually entered credit
// limit. Both encode decisions that were wrong once already: cards used to sort
// by name (which buries the one hurting your score), and a Plaid sync used to
// write its own `null` limit over a value you had typed in, blanking
// utilization everywhere it appeared.
//
import { describe, expect, it } from 'vitest'
import { rankCard, sortCardsForDisplay, shouldKeepExistingLimit } from '@/lib/cards'

const card = (
  name: string,
  balance_current: number | null,
  balance_limit: number | null
) => ({ name, balance_current, balance_limit })

describe('rankCard', () => {
  it('ranks a card with a computable utilization in the top tier', () => {
    expect(rankCard(card('a', 3400, 8500))).toEqual({ tier: 0, value: 40 })
  })

  it('puts a balance with no limit in the middle tier, ranked by balance', () => {
    expect(rankCard(card('a', 500, null))).toEqual({ tier: 1, value: 500 })
  })

  it('drops zero and unknown balances to the bottom tier', () => {
    expect(rankCard(card('a', 0, 3000)).tier).toBe(2)
    expect(rankCard(card('a', null, 4000)).tier).toBe(2)
  })

  it('treats a zero limit as unknown rather than dividing by it', () => {
    expect(rankCard(card('a', 500, 0))).toEqual({ tier: 1, value: 500 })
  })
})

describe('sortCardsForDisplay', () => {
  it('orders by utilization, highest first', () => {
    const sorted = sortCardsForDisplay([
      card('Amex', 1240, 5000), // 25%
      card('Quicksilver', 3400, 8500), // 40%
      card('Amazon', 290, 2000), // 14%
    ])
    expect(sorted.map((c) => c.name)).toEqual(['Quicksilver', 'Amex', 'Amazon'])
  })

  it('ranks a small balance on a small limit above a large one on a large limit', () => {
    // The whole point of sorting by utilization instead of balance.
    const sorted = sortCardsForDisplay([
      card('Big', 3000, 20000), // 15%
      card('Small', 300, 500), // 60%
    ])
    expect(sorted[0].name).toBe('Small')
  })

  it('places limitless cards after ranked ones but before empty ones', () => {
    const sorted = sortCardsForDisplay([
      card('Empty', 0, 3000),
      card('NoLimit', 500, null),
      card('Ranked', 100, 1000),
    ])
    expect(sorted.map((c) => c.name)).toEqual(['Ranked', 'NoLimit', 'Empty'])
  })

  it('does not mutate the caller array', () => {
    // Card colors are keyed off the original creation order — reordering it in
    // place would make a card change color whenever its balance moved.
    const original = [card('Amex', 1240, 5000), card('Quicksilver', 3400, 8500)]
    const before = original.map((c) => c.name)
    sortCardsForDisplay(original)
    expect(original.map((c) => c.name)).toEqual(before)
  })

  it('handles an empty list', () => {
    expect(sortCardsForDisplay([])).toEqual([])
  })
})

describe('shouldKeepExistingLimit', () => {
  it('keeps the stored limit when Plaid reports none', () => {
    // The regression: writing this null through erased user-entered limits.
    expect(shouldKeepExistingLimit(null, false)).toBe(true)
    expect(shouldKeepExistingLimit(undefined, false)).toBe(true)
  })

  it('keeps a user-set limit even when Plaid has one', () => {
    expect(shouldKeepExistingLimit(9000, true)).toBe(true)
  })

  it("takes Plaid's limit when the user has not overridden it", () => {
    expect(shouldKeepExistingLimit(9000, false)).toBe(false)
  })

  it('treats a genuine zero limit as a value, not as missing', () => {
    expect(shouldKeepExistingLimit(0, false)).toBe(false)
  })
})
