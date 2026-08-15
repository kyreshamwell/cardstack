// tests/utils.test.ts
//
// The money and date rules everything else is built on.
//
// The date tests are the ones worth reading: a due date is a DATE, not an
// instant, and measuring the gap in elapsed hours made the answer depend on the
// time of day — a card due today read "due tomorrow" in the morning and
// "overdue" after lunch. Statement-close prediction has the same shape.
//
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  formatCurrency,
  calcUtilization,
  getDueDateStatus,
  nextStatementClose,
  payoffToTarget,
  daysUntil,
  monthlyEquivalent,
  formatFrequency,
  formatRelativeTime,
} from '@/lib/utils'

// Anything comparing against "now" is frozen, otherwise these tests pass or
// fail depending on the time of day they run.
const NOW = new Date('2026-08-12T12:00:00Z')

afterEach(() => {
  vi.useRealTimers()
})

function freeze() {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
}

describe('formatCurrency', () => {
  it('formats with separators and two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('keeps the sign on negatives (payments and refunds)', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })
})

describe('calcUtilization', () => {
  it('returns a whole percentage', () => {
    expect(calcUtilization(500, 2000)).toBe(25)
    expect(calcUtilization(0, 1000)).toBe(0)
  })

  it('guards divide-by-zero rather than returning Infinity or NaN', () => {
    expect(calcUtilization(500, 0)).toBe(0)
  })

  it('can exceed 100 when a card is over its limit', () => {
    expect(calcUtilization(1100, 1000)).toBe(110)
  })
})

describe('getDueDateStatus', () => {
  it('classifies past dates as overdue', () => {
    freeze()
    expect(getDueDateStatus(new Date('2026-08-10T12:00:00Z'))).toBe('overdue')
  })

  it('treats the next week as due-soon', () => {
    freeze()
    expect(getDueDateStatus(new Date('2026-08-15T12:00:00Z'))).toBe('due-soon')
  })

  it('treats the seven-day boundary as due-soon, not upcoming', () => {
    freeze()
    expect(getDueDateStatus(new Date('2026-08-19T12:00:00Z'))).toBe('due-soon')
  })

  it('classifies anything further out as upcoming', () => {
    freeze()
    expect(getDueDateStatus(new Date('2026-09-01T12:00:00Z'))).toBe('upcoming')
  })
})

describe('nextStatementClose', () => {
  it('returns null without a statement date', () => {
    expect(nextStatementClose(null)).toBeNull()
  })

  it('returns null for an unparseable date rather than an Invalid Date', () => {
    expect(nextStatementClose('not-a-date')).toBeNull()
  })

  it('steps forward a month from the last close', () => {
    freeze()
    const next = nextStatementClose('2026-08-03')
    expect(next?.toISOString().slice(0, 10)).toBe('2026-09-03')
  })

  it('keeps stepping until it lands in the future, not just once', () => {
    freeze()
    // Five months stale — a single +1 month would still be in the past.
    const next = nextStatementClose('2026-03-05')
    expect(next).not.toBeNull()
    expect(next!.getTime()).toBeGreaterThan(NOW.getTime())
    expect(next?.toISOString().slice(0, 10)).toBe('2026-09-05')
  })

  it('gives up instead of looping forever on an ancient date', () => {
    freeze()
    // Past the 60-step guard, so it bails rather than spinning.
    expect(nextStatementClose('1900-01-01')).toBeNull()
  })
})

describe('payoffToTarget', () => {
  it('returns the amount needed to reach the target', () => {
    expect(payoffToTarget(3400, 8500)).toBe(850) // 40% -> 30%
  })

  it('returns zero when already under target', () => {
    expect(payoffToTarget(500, 5000)).toBe(0)
  })

  it('never returns a negative payoff', () => {
    expect(payoffToTarget(1, 100000)).toBe(0)
  })

  it('guards a zero or missing limit', () => {
    expect(payoffToTarget(500, 0)).toBe(0)
  })

  it('honours a custom target', () => {
    expect(payoffToTarget(1000, 2000, 10)).toBe(800)
  })
})

describe('daysUntil', () => {
  it('counts forward', () => {
    freeze()
    expect(daysUntil(new Date('2026-08-18T12:00:00Z'))).toBe(6)
  })

  it('goes negative for past dates', () => {
    freeze()
    expect(daysUntil(new Date('2026-08-10T12:00:00Z'))).toBeLessThan(0)
  })

  // Regression: this measured elapsed hours and rounded up, so the answer moved
  // with the clock — a card due today read as "tomorrow" in the morning and as
  // overdue in the afternoon.
  it('returns 0 for any time today, morning or night', () => {
    const today = new Date()

    for (const hour of [0, 9, 12, 18, 23]) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour))

      const noonToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
      expect(daysUntil(noonToday), `failed at ${hour}:00`).toBe(0)

      vi.useRealTimers()
    }
  })

  it('counts calendar days, not 24-hour blocks', () => {
    const base = new Date(2026, 7, 12, 23, 30) // 11:30pm
    vi.useFakeTimers()
    vi.setSystemTime(base)

    // Half an hour later is a different day, and must count as one.
    expect(daysUntil(new Date(2026, 7, 13, 0, 15))).toBe(1)

    vi.useRealTimers()
  })
})

describe('getDueDateStatus — same-day handling', () => {
  it('never calls a card due today overdue, whatever the hour', () => {
    const today = new Date()

    for (const hour of [8, 13, 22]) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour))

      const dueToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
      expect(getDueDateStatus(dueToday), `failed at ${hour}:00`).toBe('due-soon')

      vi.useRealTimers()
    }
  })
})

describe('monthlyEquivalent', () => {
  it('leaves monthly charges alone', () => {
    expect(monthlyEquivalent(22.99, 'MONTHLY')).toBeCloseTo(22.99, 5)
  })

  it('converts weekly using 52 weeks, not 4 per month', () => {
    expect(monthlyEquivalent(10, 'WEEKLY')).toBeCloseTo(43.333, 3)
  })

  it('converts biweekly using 26 periods', () => {
    expect(monthlyEquivalent(10, 'BIWEEKLY')).toBeCloseTo(21.667, 3)
  })

  it('doubles semi-monthly', () => {
    expect(monthlyEquivalent(10, 'SEMI_MONTHLY')).toBe(20)
  })

  it('divides annual charges over twelve months', () => {
    expect(monthlyEquivalent(120, 'ANNUALLY')).toBe(10)
  })

  it('treats unknown cadence as monthly so a real charge is never under-counted', () => {
    expect(monthlyEquivalent(15, 'UNKNOWN')).toBe(15)
    expect(monthlyEquivalent(15, null)).toBe(15)
  })
})

describe('formatFrequency', () => {
  it('renders each cadence readably', () => {
    expect(formatFrequency('WEEKLY')).toBe('Weekly')
    expect(formatFrequency('BIWEEKLY')).toBe('Every 2 weeks')
    expect(formatFrequency('SEMI_MONTHLY')).toBe('Twice a month')
    expect(formatFrequency('ANNUALLY')).toBe('Yearly')
  })

  it('falls back rather than printing UNKNOWN at the user', () => {
    expect(formatFrequency('UNKNOWN')).toBe('Recurring')
    expect(formatFrequency(null)).toBe('Recurring')
  })
})

describe('formatRelativeTime', () => {
  it('collapses the last minute to "just now"', () => {
    freeze()
    expect(formatRelativeTime(new Date(NOW.getTime() - 30_000))).toBe('just now')
  })

  it('reports minutes and hours', () => {
    freeze()
    expect(formatRelativeTime(new Date(NOW.getTime() - 5 * 60_000))).toBe('5 min ago')
    expect(formatRelativeTime(new Date(NOW.getTime() - 3 * 3_600_000))).toBe('3 hrs ago')
  })

  it('singularises one hour', () => {
    freeze()
    expect(formatRelativeTime(new Date(NOW.getTime() - 3_600_000))).toBe('1 hr ago')
  })

  it('says yesterday before switching to a day count', () => {
    freeze()
    expect(formatRelativeTime(new Date(NOW.getTime() - 26 * 3_600_000))).toBe('yesterday')
    expect(formatRelativeTime(new Date(NOW.getTime() - 3 * 86_400_000))).toBe('3 days ago')
  })

  it('does not report a future timestamp as a huge age', () => {
    freeze()
    expect(formatRelativeTime(new Date(NOW.getTime() + 60_000))).toBe('just now')
  })
})
