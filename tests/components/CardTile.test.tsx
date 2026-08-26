// tests/components/CardTile.test.tsx
//
// The card row carries several decisions that were wrong at some point:
// which balance leads, when a due date is allowed to look alarming, and what
// stays hidden until the row is expanded. Dates are built relative to now
// rather than frozen, so these read the same way the component computes them.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardTile, type CardTileData } from '@/components/cards/CardTile'

/**
 * A YYYY-MM-DD date the given number of days from today, in LOCAL time.
 *
 * Not toISOString(): that converts to UTC, so running late in the day pushes
 * the date to tomorrow and every offset lands a day out. The component parses
 * these as `${date}T12:00:00`, i.e. local noon, so they have to be built the
 * same way.
 */
function daysFromNow(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function card(overrides: Partial<CardTileData> = {}): CardTileData {
  return {
    id: 'card_1',
    name: 'Amex Platinum',
    institutionName: 'American Express',
    mask: '4823',
    isManual: false,
    balance_current: 1240,
    balance_available: 3760,
    balance_limit: 5000,
    statement_balance: 890,
    statement_date: daysFromNow(-9),
    minimum_payment: 35,
    due_date: daysFromNow(6),
    ...overrides,
  }
}

const renderTile = (overrides: Partial<CardTileData> = {}, props = {}) =>
  render(<CardTile card={card(overrides)} accent="var(--s1)" {...props} />)

describe('CardTile: which balance leads', () => {
  it('leads with the statement balance, the amount that avoids interest', () => {
    renderTile()

    expect(screen.getByText('$890.00')).toBeInTheDocument()
    expect(screen.getByText('statement')).toBeInTheDocument()
  })

  it('falls back to the current balance when the bank reports no statement', () => {
    renderTile({ statement_balance: null })

    expect(screen.getByText('$1,240.00')).toBeInTheDocument()
    expect(screen.getByText('current')).toBeInTheDocument()
  })

  it('shows a dash rather than $0.00 when there is no balance at all', () => {
    renderTile({ statement_balance: null, balance_current: null })

    // Both the headline and the utilization fall back to a dash here.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})

describe('CardTile: due dates', () => {
  it('counts down the days remaining', () => {
    renderTile({ due_date: daysFromNow(6) })
    expect(screen.getByText(/due in 6d/)).toBeInTheDocument()
  })

  it('says due today and due tomorrow rather than 0d and 1d', () => {
    renderTile({ due_date: daysFromNow(0) })
    expect(screen.getByText(/due today/)).toBeInTheDocument()

    renderTile({ due_date: daysFromNow(1) })
    expect(screen.getByText(/due tomorrow/)).toBeInTheDocument()
  })

  it('marks a genuinely late card overdue', () => {
    renderTile({ due_date: daysFromNow(-3), minimum_payment: 35 })
    expect(screen.getByText(/overdue/)).toBeInTheDocument()
  })

  it('does NOT say overdue when the minimum payment is zero', () => {
    // Nothing is actually owed, so the red "overdue" was just alarming.
    renderTile({ due_date: daysFromNow(-3), minimum_payment: 0 })

    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  })

  it('omits the due line entirely when there is no due date', () => {
    renderTile({ due_date: null })

    expect(screen.queryByText(/due in/)).not.toBeInTheDocument()
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  })
})

describe('CardTile: utilization', () => {
  it('shows utilization against the limit', () => {
    renderTile({ balance_current: 1240, balance_limit: 5000 })
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('shows a dash when no limit is known, instead of implying 0%', () => {
    // A wiped or missing limit must not read as healthy.
    renderTile({ balance_limit: null })
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('CardTile: expanding', () => {
  it('keeps the detail rows hidden until expanded', () => {
    renderTile()

    expect(screen.queryByText('Available')).not.toBeInTheDocument()
    expect(screen.queryByText('Minimum payment')).not.toBeInTheDocument()
  })

  it('reveals the detail rows on click', async () => {
    const user = userEvent.setup()
    renderTile()

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('Current balance')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Credit limit')).toBeInTheDocument()
    expect(screen.getByText('Minimum payment')).toBeInTheDocument()
    expect(screen.getByText('Statement closes')).toBeInTheDocument()
  })

  it('collapses again on a second click', async () => {
    const user = userEvent.setup()
    renderTile()
    const toggle = screen.getByRole('button')

    await user.click(toggle)
    expect(screen.getByText('Available')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByText('Available')).not.toBeInTheDocument()
  })

  it('reports its expanded state for assistive tech', async () => {
    const user = userEvent.setup()
    renderTile()
    const toggle = screen.getByRole('button')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('derives available credit when the bank does not report it', async () => {
    const user = userEvent.setup()
    renderTile({ balance_available: null, balance_limit: 5000, balance_current: 1240 })

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('$3,760.00')).toBeInTheDocument()
  })

  it('omits the minimum payment row when the bank reports none', async () => {
    const user = userEvent.setup()
    renderTile({ minimum_payment: null })

    await user.click(screen.getByRole('button'))

    expect(screen.queryByText('Minimum payment')).not.toBeInTheDocument()
  })

  it('shows actions and the limit control only once expanded', async () => {
    const user = userEvent.setup()
    renderTile(
      {},
      {
        actions: <button type="button">Pay this card</button>,
        limitControl: <span>limit editor</span>,
      }
    )

    expect(screen.queryByText('Pay this card')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button')[0])

    expect(screen.getByText('Pay this card')).toBeInTheDocument()
    expect(screen.getByText('limit editor')).toBeInTheDocument()
  })
})

describe('CardTile: identity', () => {
  it('shows the mask for a connected card', () => {
    renderTile({ mask: '4823' })
    expect(screen.getByText(/···· 4823/)).toBeInTheDocument()
  })

  it('labels a manual card instead of showing an empty mask', () => {
    renderTile({ mask: null, isManual: true })
    expect(screen.getByText(/Manual/)).toBeInTheDocument()
  })

  it('carries its id so the chart can single it out', () => {
    const { container } = renderTile({ id: 'card_xyz' })
    expect(container.querySelector('[data-card-id="card_xyz"]')).toBeTruthy()
  })
})
