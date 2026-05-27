// lib/utils.ts — shared utility functions.
//
// These are pure functions: no side effects, no imports, easy to unit test.
// Financial display logic lives here so it's consistent across every component.

/**
 * Formats a number as a USD currency string.
 *
 * Uses the browser's built-in Intl.NumberFormat rather than a library —
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
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'due-soon'
  return 'upcoming'
}
