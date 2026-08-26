// tests/components/privacy.test.tsx
//
// Privacy mode is nothing but a CSS rule: `.privacy-mode .sensitive-value`
// gets `filter: blur(8px)`. That makes it opt-in per element, which makes it
// exactly the kind of feature that rots: a new component renders a figure,
// nobody adds the class, and the leak is invisible because everything still
// looks correct with privacy mode OFF.
//
// That's already happened twice: BalancePie shipped with an unblurred center
// total and legend, and the CSV import preview showed a real amount.
//
// So this file doesn't check specific elements. It renders each component that
// shows money and sweeps the DOM for anything that LOOKS like currency,
// failing on any occurrence that isn't inside a `.sensitive-value`. A new
// component only has to be added to the render list to be covered; forgetting
// the class then fails here rather than on someone's shared screen.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BalancePie } from '@/components/cards/BalancePie'
import { CardTile, type CardTileData } from '@/components/cards/CardTile'
import { ImportCsvButton } from '@/components/cards/ImportCsvButton'
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'
import { RecentTransactions } from '@/components/cards/RecentTransactions'
import { RecurringCharges } from '@/components/cards/RecurringCharges'
import { BeforeStatementCloses } from '@/components/cards/BeforeStatementCloses'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// "$1,234.50" and bare "42%". Both are figures worth hiding: the percentage in
// this app is credit utilization, which says as much about someone's finances
// as the balance does.
const FIGURE = /\$\s?[\d,]+(\.\d+)?|\b\d+(\.\d+)?%/

/**
 * Every text node under `root` that reads as a figure but sits outside any
 * `.sensitive-value`, i.e. everything privacy mode would fail to blur.
 *
 * Walks text nodes rather than elements because the class is usually on an
 * ancestor (`<p class="sensitive-value">{formatCurrency(x)}</p>`), and because
 * a figure is sometimes split across siblings, checking `closest()` from the
 * text node's parent handles both without caring about the markup shape.
 */
function unblurredFigures(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const leaks: string[] = []

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ''
    if (!FIGURE.test(text)) continue
    if (node.parentElement?.closest('.sensitive-value')) continue
    leaks.push(text)
  }

  return leaks
}

/** Sanity check on the sweep itself. See the self-test at the bottom. */
function sensitiveCount(root: HTMLElement): number {
  return root.querySelectorAll('.sensitive-value').length
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function daysFromNow(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

const CARD: CardTileData = {
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
  due_date: daysFromNow(12),
  minimum_payment: 35,
}

const SLICES = [
  { id: 'card_1', name: 'Amex Platinum', balance: 1240, limit: 5000, color: '#6366f1' },
  { id: 'card_2', name: 'Quicksilver', balance: 3600, limit: 4000, color: '#22d3ee' },
]

const COLORS = { card_1: '#6366f1', card_2: '#22d3ee' }
const NAMES = { card_1: 'Amex Platinum', card_2: 'Quicksilver' }

// ─── The sweep ──────────────────────────────────────────────────────────────

const CASES: Array<[string, () => React.ReactElement]> = [
  ['CardTile (collapsed)', () => <CardTile accent="#6366f1" card={CARD} />],
  [
    'BalancePie',
    () => <BalancePie slices={SLICES} />,
  ],
  ['ManualLimitInput', () => <ManualLimitInput cardId="card_1" currentLimit={5000} />],
  [
    'RecentTransactions',
    () => (
      <RecentTransactions
        cardNameById={NAMES}
        colorById={COLORS}
        newSince={null}
        transactions={[
          {
            id: 'tx_1',
            card_id: 'card_1',
            name: 'SHELL OIL',
            merchant_name: 'Shell',
            amount: 52,
            transaction_date: daysFromNow(-2),
            pending: false,
            category: 'Travel',
            created_at: null,
          },
          {
            id: 'tx_2',
            card_id: 'card_2',
            name: 'PAYMENT THANK YOU',
            merchant_name: null,
            amount: -400,
            transaction_date: daysFromNow(-5),
            pending: false,
            category: null,
            created_at: null,
          },
        ]}
      />
    ),
  ],
  [
    'RecurringCharges',
    () => (
      <RecurringCharges
        cardNameById={NAMES}
        charges={[
          {
            id: 'rec_1',
            card_id: 'card_1',
            description: 'NETFLIX',
            merchant_name: 'Netflix',
            frequency: 'MONTHLY',
            average_amount: 22.99,
            last_amount: 22.99,
            predicted_next_date: daysFromNow(9),
            status: 'MATURE',
          },
          {
            id: 'rec_2',
            card_id: 'card_2',
            description: 'AMZN PRIME',
            merchant_name: 'Amazon',
            frequency: 'ANNUALLY',
            average_amount: 139,
            last_amount: 139,
            predicted_next_date: daysFromNow(80),
            status: 'MATURE',
          },
        ]}
        colorById={COLORS}
      />
    ),
  ],
  [
    'BeforeStatementCloses',
    () => (
      <BeforeStatementCloses
        cards={[
          {
            id: 'card_2',
            name: 'Quicksilver',
            balance_current: 3600,
            balance_limit: 4000,
            statement_date: daysFromNow(-20),
          },
        ]}
        colorById={COLORS}
      />
    ),
  ],
]

describe('privacy mode: every rendered figure opts in', () => {
  it.each(CASES)('%s', (_name, renderCase) => {
    const { container } = render(renderCase())
    expect(unblurredFigures(container)).toEqual([])
  })
})

describe('privacy mode: figures behind an interaction', () => {
  // Most of a card's numbers (current balance, available, limit, minimum
  // payment) only exist once the row is expanded, so the collapsed render in
  // the sweep above barely touches them.
  it('blurs everything in an expanded CardTile', async () => {
    const user = userEvent.setup()
    const { container } = render(<CardTile accent="#6366f1" card={CARD} />)

    await user.click(screen.getByRole('button', { name: /Amex Platinum/ }))

    expect(screen.getByText('Minimum payment')).toBeInTheDocument()
    expect(unblurredFigures(container)).toEqual([])
  })

  // ManualLimitInput replaces the limit row, so it has its own blur to get
  // right, and it starts in edit mode when there's no limit yet.
  it('blurs the limit ManualLimitInput renders in place of the plain row', () => {
    const { container } = render(
      <CardTile
        accent="#6366f1"
        card={CARD}
        limitControl={<ManualLimitInput cardId="card_1" currentLimit={5000} />}
      />
    )

    expect(unblurredFigures(container)).toEqual([])
  })
})

describe('privacy mode: the CSV import preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ imported: 1, skipped: 0 }),
    }) as unknown as typeof fetch
  })

  // Not part of the sweep above because the amount only appears after a file
  // is chosen, but it's a real leak surface: the preview shows a genuine
  // transaction amount from the user's statement.
  it('blurs the amount in the first-row preview', async () => {
    const user = userEvent.setup()
    render(<ImportCsvButton cards={[{ id: 'card_1', name: 'Amex Platinum' }]} />)

    await user.click(screen.getByRole('button', { name: 'Import' }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(
      input,
      new File(
        ['Transaction Date,Description,Amount\n08/09/2026,SHELL OIL,-52.00'],
        'statement.csv',
        { type: 'text/csv' }
      )
    )

    const preview = await screen.findByText(/First row reads as/)
    const block = preview.closest('div') as HTMLElement

    expect(unblurredFigures(block)).toEqual([])
    expect(sensitiveCount(block)).toBeGreaterThan(0)
  })
})

describe('the sweep itself', () => {
  // The sweep can only fail if it actually sees the figures. A component whose
  // numbers live somewhere a TreeWalker can't reach (shadow DOM, canvas)
  // would pass vacuously and prove nothing, so pin that it finds real text.
  it('finds figures that are missing the class', () => {
    const { container } = render(
      <div>
        <p className="sensitive-value">$1,240.00</p>
        <p>$3,600.00</p>
        <p>72%</p>
      </div>
    )

    expect(unblurredFigures(container)).toEqual(['$3,600.00', '72%'])
  })

  // The pie is the one that matters here: it's a vendored chart, and its center
  // value goes through NumberFlow, a custom element. If NumberFlow put its
  // digits in shadow DOM the walker would never see them and the BalancePie
  // case above would pass no matter what. This asserts reachability only, and it
  // must keep passing with or without the sensitive-value fix.
  it('sees the pie center total and legend amounts as plain text', () => {
    const { container } = render(<BalancePie slices={SLICES} />)
    const text = container.textContent ?? ''

    expect(text).toMatch(/\$1,240/) // legend
    expect(text).toMatch(/4,840/) // center total, prefixed separately
  })
})
