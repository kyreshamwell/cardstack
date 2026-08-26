// lib/utils.ts: shared utility functions.
//
// These are pure functions: no side effects, no imports, easy to unit test.
// Financial display logic lives here so it's consistent across every component.

/**
 * Formats a number as a USD currency string.
 *
 * Uses the browser's built-in Intl.NumberFormat rather than a library, since
 * it handles locale, grouping separators, and decimal places correctly.
 *
 * @example
 *   formatCurrency(1234.5)   // "$1,234.50"
 *   formatCurrency(0)        // "$0.00"
 *   formatCurrency(-500)     // "-$500.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Calculates credit utilization as a whole-number percentage.
 *
 * Utilization = balance / credit limit × 100
 * < 30% is considered healthy by most scoring models.
 *
 * @example
 *   calcUtilization(500, 2000)  // 25   → 25% utilized
 *   calcUtilization(0, 1000)    // 0
 *   calcUtilization(500, 0)     // 0    → guard against divide-by-zero
 */
export function calcUtilization(balance: number, limit: number): number {
  if (limit === 0) return 0
  return Math.round((balance / limit) * 100)
}

/**
 * Returns a status label based on how close a due date is.
 *
 * Used to drive conditional UI (color coding, warning badges).
 *
 * @example
 *   getDueDateStatus(yesterday)    // "overdue"
 *   getDueDateStatus(in3Days)      // "due-soon"
 *   getDueDateStatus(in20Days)     // "upcoming"
 */
export type DueDateStatus = 'overdue' | 'due-soon' | 'upcoming'

export function getDueDateStatus(dueDate: Date): DueDateStatus {
  const diffDays = daysUntil(dueDate)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'due-soon'
  return 'upcoming'
}

/**
 * Formats a past timestamp as a short relative string.
 *
 * Used for the "Updated 2 min ago" line beside the refresh control. Without
 * it there's no signal that data is fresh, which reads as data being wrong.
 *
 * @example
 *   formatRelativeTime(30_000 ms ago)  // "just now"
 *   formatRelativeTime(5 min ago)      // "5 min ago"
 *   formatRelativeTime(3 hours ago)    // "3 hrs ago"
 *   formatRelativeTime(2 days ago)     // "2 days ago"
 */
/**
 * Predicts when the next statement closes, given the last one's issue date.
 *
 * This is the date that actually matters for credit scores: utilization is
 * reported to the bureaus at statement close, NOT at the due date. Paying after
 * the statement closes still avoids interest, but the high balance was already
 * reported.
 *
 * Statements close on roughly the same day each month, so we step forward a
 * month at a time from the last known close until we land in the future.
 * Returns null when we have no statement date to work from.
 */
export function nextStatementClose(statementDate: string | null): Date | null {
  if (!statementDate) return null

  const next = new Date(`${statementDate}T12:00:00`)
  if (Number.isNaN(next.getTime())) return null

  const now = Date.now()
  // Guard the loop: a wildly stale date shouldn't spin forever.
  for (let i = 0; i < 60 && next.getTime() <= now; i++) {
    next.setMonth(next.getMonth() + 1)
  }

  return next.getTime() > now ? next : null
}

/**
 * How much must be paid down to report at or under a target utilization.
 *
 * Returns 0 when the card is already under target.
 *
 * @example
 *   payoffToTarget(3400, 8500)      // 850  → 40% down to 30%
 *   payoffToTarget(500, 5000)       // 0    → already at 10%
 */
export function payoffToTarget(
  balance: number,
  limit: number,
  targetPercent = 30
): number {
  if (limit <= 0) return 0
  const target = limit * (targetPercent / 100)
  return Math.max(0, balance - target)
}

/**
 * Calendar days from today until `date`. 0 is today, 1 tomorrow, -1 yesterday.
 *
 * Compares whole days rather than elapsed milliseconds. Measuring the gap in
 * hours made the answer depend on the time of day: a card due at noon today
 * read as "due tomorrow" in the morning (any positive fraction rounds up to 1)
 * and as "overdue" in the afternoon. A due date is a date, not an instant.
 */
export function daysUntil(date: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  return Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000)
}

/**
 * Normalizes a recurring charge to what it costs per month.
 *
 * Plaid reports each stream at its own cadence, so a $9.99 weekly charge and a
 * $9.99 annual one look identical until you convert them. Comparing
 * subscriptions, and totalling them, only makes sense on a common footing.
 *
 * UNKNOWN frequency is treated as monthly: it's the most common cadence, and
 * under-counting a real charge is worse than the alternative.
 *
 * @example
 *   monthlyEquivalent(10, 'WEEKLY')    // 43.33
 *   monthlyEquivalent(120, 'ANNUALLY') // 10
 */
export function monthlyEquivalent(amount: number, frequency: string | null): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12
    case 'BIWEEKLY':
      return (amount * 26) / 12
    case 'SEMI_MONTHLY':
      return amount * 2
    case 'ANNUALLY':
      return amount / 12
    case 'MONTHLY':
    default:
      return amount
  }
}

/** Human-readable cadence label for a Plaid recurring frequency. */
export function formatFrequency(frequency: string | null): string {
  switch (frequency) {
    case 'WEEKLY':
      return 'Weekly'
    case 'BIWEEKLY':
      return 'Every 2 weeks'
    case 'SEMI_MONTHLY':
      return 'Twice a month'
    case 'MONTHLY':
      return 'Monthly'
    case 'ANNUALLY':
      return 'Yearly'
    default:
      return 'Recurring'
  }
}

export function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diffSec < 0) return 'just now'
  if (diffSec < 60) return 'just now'

  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min} min ago`

  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`

  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
