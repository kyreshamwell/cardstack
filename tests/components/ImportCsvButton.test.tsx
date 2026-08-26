// tests/components/ImportCsvButton.test.tsx
//
// The highest-consequence component in the app. Getting the sign convention
// backwards doesn't throw or warn. It silently imports every purchase as a
// refund, which quietly understates what you owe. These tests pin that
// behaviour in both directions and check the preview the user actually decides
// from.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportCsvButton } from '@/components/cards/ImportCsvButton'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const CARDS = [
  { id: 'card_1', name: 'Amex Platinum' },
  { id: 'card_2', name: 'Quicksilver' },
]

// A realistic export: quoted description containing a comma, a payment, and a
// row that cannot be read at all.
const CSV = [
  'Transaction Date,Description,Amount',
  '08/09/2026,"SHELL OIL, STORE 42",-52.00',
  '08/08/2026,PAYMENT THANK YOU,400.00',
  'garbage,,not-a-number',
].join('\n')

function csvFile(contents = CSV, name = 'statement.csv') {
  return new File([contents], name, { type: 'text/csv' })
}

/** Opens the dialog and selects a file, returning the user-event instance. */
async function openWithFile(contents = CSV) {
  const user = userEvent.setup()
  render(<ImportCsvButton cards={CARDS} />)

  await user.click(screen.getByRole('button', { name: 'Import' }))

  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, csvFile(contents))

  await screen.findByText(/statement\.csv/)
  return user
}

/** Selects are rendered in DOM order: card, date, description, amount. */
function selects() {
  const all = screen.getAllByRole('combobox') as HTMLSelectElement[]
  return { card: all[0], date: all[1], description: all[2], amount: all[3] }
}

function lastImportBody() {
  const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)
  return JSON.parse((call?.[1] as RequestInit).body as string)
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ imported: 2, skipped: 1 }),
  }) as unknown as typeof fetch
})

describe('ImportCsvButton: opening', () => {
  it('renders nothing when there are no cards to import into', () => {
    const { container } = render(<ImportCsvButton cards={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a file picker once opened', async () => {
    const user = userEvent.setup()
    render(<ImportCsvButton cards={CARDS} />)

    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(screen.getByText('Import transactions')).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeTruthy()
  })
})

describe('ImportCsvButton: parsing and column mapping', () => {
  it('reports how many data rows the file has, excluding the header', async () => {
    await openWithFile()
    expect(screen.getByText(/statement\.csv · 3 rows/)).toBeInTheDocument()
  })

  it('auto-guesses the date, description and amount columns', async () => {
    await openWithFile()
    const s = selects()

    // Header row is: Transaction Date, Description, Amount
    expect(s.date.value).toBe('0')
    expect(s.description.value).toBe('1')
    expect(s.amount.value).toBe('2')
  })

  it('leaves columns unmapped when nothing matches, rather than guessing wrong', async () => {
    await openWithFile('colA,colB,colC\n1,2,3')
    const s = selects()

    expect(s.date.value).toBe('-1')
    expect(s.amount.value).toBe('-1')
  })

  it('counts readable rows and reports the rest as skipped', async () => {
    await openWithFile()
    // Two good rows; the third has an unparseable date, amount and description.
    expect(screen.getByText(/2 rows ready/)).toBeInTheDocument()
    expect(screen.getByText(/1 skipped as unreadable/)).toBeInTheDocument()
  })
})

describe('ImportCsvButton: sign convention', () => {
  it('defaults to treating negative numbers as purchases', async () => {
    await openWithFile()

    // -52.00 in the file is a purchase, so it is stored as +52 (money out).
    expect(screen.getByText('SHELL OIL, STORE 42')).toBeInTheDocument()
    expect(screen.getByText('$52.00')).toBeInTheDocument()
    expect(screen.getByText(/treated as a purchase/)).toBeInTheDocument()
  })

  it('flips every amount when the other convention is chosen', async () => {
    const user = await openWithFile()

    await user.click(screen.getByRole('button', { name: /Positive/ }))

    // Same row now reads as money coming back.
    expect(screen.getByText('−$52.00')).toBeInTheDocument()
    expect(screen.getByText(/treated as a payment or refund/)).toBeInTheDocument()
  })

  it('sends purchases as positive and payments as negative by default', async () => {
    const user = await openWithFile()

    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const body = lastImportBody()

    // Plaid's convention: positive = money out.
    expect(body.rows).toEqual([
      { date: '2026-08-09', description: 'SHELL OIL, STORE 42', amount: 52 },
      { date: '2026-08-08', description: 'PAYMENT THANK YOU', amount: -400 },
    ])
  })

  it('sends the inverse when the file uses positive purchases', async () => {
    const user = await openWithFile()

    await user.click(screen.getByRole('button', { name: /Positive/ }))
    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const body = lastImportBody()

    expect(body.rows.map((r: { amount: number }) => r.amount)).toEqual([-52, 400])
  })
})

describe('ImportCsvButton: submission', () => {
  it('posts to the import endpoint with the chosen card', async () => {
    const user = await openWithFile()

    await user.selectOptions(selects().card, 'card_2')
    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)!
    expect(url).toBe('/api/transactions/import')
    expect(lastImportBody().cardId).toBe('card_2')
  })

  it('never sends the rows it could not read', async () => {
    const user = await openWithFile()

    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    expect(lastImportBody().rows).toHaveLength(2)
  })

  it('refreshes the page after a successful import', async () => {
    const user = await openWithFile()

    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('surfaces a server error instead of silently closing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Card not found' }),
    }) as unknown as typeof fetch

    const user = await openWithFile()
    await user.click(screen.getByRole('button', { name: /Import 2 rows/ }))

    expect(await screen.findByText('Card not found')).toBeInTheDocument()
    // The dialog stays open so the import is not silently lost.
    expect(screen.getByText('Import transactions')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('rejects a file with no data rows', async () => {
    // Not using the helper: a rejected file never reports a filename, which is
    // what the helper waits for.
    const user = userEvent.setup()
    render(<ImportCsvButton cards={CARDS} />)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, csvFile('just,a,header'))

    expect(await screen.findByText(/no data rows/i)).toBeInTheDocument()
    // Still on the picker, so another file can be chosen.
    expect(document.querySelector('input[type="file"]')).toBeTruthy()
  })
})
