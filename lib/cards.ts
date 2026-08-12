// lib/cards.ts — card ordering and sync rules.
//
// These live here rather than inline in the page and the sync route so they can
// be tested directly. Both encode decisions that were wrong once already.

import { calcUtilization } from './utils'

/** Minimum shape needed to rank a card — matches the DB row structurally. */
export interface RankableCard {
  balance_current: number | null
  balance_limit: number | null
}

export interface CardRank {
  /** 0 = has a computable utilization, 1 = balance but no limit, 2 = nothing owed */
  tier: number
  /** Utilization % for tier 0, balance for tier 1, 0 for tier 2 */
  value: number
}

/**
 * Ranks a card for display order.
 *
 * Cards carrying a balance rank by utilization, because that's the number that
 * affects a credit score — a $300 balance against a $500 limit matters more
 * than $3,000 against $20,000. Cards with a balance but no known limit have no
 * percentage to sort by, so they follow. Anything at zero sinks to the bottom.
 */
export function rankCard(card: RankableCard): CardRank {
  const balance = card.balance_current ?? 0
  if (balance <= 0) return { tier: 2, value: 0 }
  if (!card.balance_limit) return { tier: 1, value: balance }
  return { tier: 0, value: calcUtilization(balance, card.balance_limit) }
}

/**
 * Orders cards for display: highest utilization first.
 *
 * Returns a new array — the caller's order is the stable, creation-ordered one
 * that card colors are keyed off, and reordering it in place would make a card
 * change color whenever its balance moved.
 */
export function sortCardsForDisplay<T extends RankableCard>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const ra = rankCard(a)
    const rb = rankCard(b)
    if (ra.tier !== rb.tier) return ra.tier - rb.tier
    return rb.value - ra.value
  })
}

/**
 * Whether a Plaid sync should leave the stored credit limit alone.
 *
 * Two cases, both of which destroyed real data before this existed:
 *   - Plaid reports no limit at all (common), and writing that null through
 *     erased whatever the user had typed in.
 *   - The user set the limit by hand, so Plaid's value must not clobber it even
 *     when Plaid has one.
 *
 * Losing the limit isn't cosmetic: utilization is computed from it, so a wiped
 * limit silently blanks that card's percentage everywhere it appears.
 */
export function shouldKeepExistingLimit(
  plaidLimit: number | null | undefined,
  limitIsManual: boolean
): boolean {
  return limitIsManual || plaidLimit == null
}
