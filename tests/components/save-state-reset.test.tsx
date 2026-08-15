// tests/components/save-state-reset.test.tsx
//
// Every write control in the dashboard sets a `saving` flag, fires a fetch,
// then calls router.refresh() on success. The trap is that **router.refresh()
// does not unmount the component** — it re-fetches server data and React
// reconciles, so client state survives. Code that clears the flag only on the
// error path leaves it stuck at true forever, and the control comes back
// permanently disabled reading "Saving…".
//
// That shipped in four components at once, and it is invisible in the happy
// path you test by hand: the dialog closes, everything looks fine, and the
// button is only wrong the SECOND time you open it. Hence this test — it always
// performs the action twice.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditManualCardButton } from '@/components/cards/EditManualCardButton'
import { AddManualCardButton } from '@/components/cards/AddManualCardButton'
import { ManualLimitInput } from '@/components/cards/ManualLimitInput'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

/** A fetch that always succeeds — the path that used to strand the flag. */
function fetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  })
}

beforeEach(() => {
  refresh.mockClear()
  vi.stubGlobal('fetch', fetchOk())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a successful save leaves the control usable', () => {
  it('EditManualCardButton: the button is not stuck on "Saving…" when reopened', async () => {
    const user = userEvent.setup()
    render(
      <EditManualCardButton
        cardId="card_1"
        cardName="Sapphire"
        currentInstitution="Chase"
        currentBalance={100}
        currentLimit={1000}
        currentDueDate={null}
        currentMinPayment={null}
      />
    )

    await user.click(screen.getByTitle('Edit card'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())

    // Reopen. Before the fix this read "Saving…" and was disabled.
    await user.click(screen.getByTitle('Edit card'))
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeEnabled()
  })

  it('AddManualCardButton: the button is not stuck on "Saving…" when reopened', async () => {
    const user = userEvent.setup()
    render(<AddManualCardButton />)

    // Selected by placeholder: the dialog's <label>s carry no htmlFor, so they
    // aren't associated with their inputs and getByLabelText can't see them.
    await user.click(screen.getByRole('button', { name: /add manually/i }))
    await user.type(screen.getByPlaceholderText(/amazon store card/i), 'Freedom')
    const [balance, limit] = screen.getAllByPlaceholderText('0.00')
    await user.type(balance, '250')
    await user.type(limit, '5000')
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /add manually/i }))
    expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled()
  })

  it('ManualLimitInput: the editor reopens with a live Save button', async () => {
    const user = userEvent.setup()
    render(<ManualLimitInput cardId="card_1" currentLimit={1000} />)

    await user.click(screen.getByTitle('Edit limit'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())

    await user.click(screen.getByTitle('Edit limit'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

describe('a network failure surfaces instead of hanging', () => {
  it('ManualLimitInput reports a dead connection and re-enables Save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const user = userEvent.setup()
    render(<ManualLimitInput cardId="card_1" currentLimit={1000} />)

    await user.click(screen.getByTitle('Edit limit'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // fetch REJECTS here rather than resolving with ok:false. That path was
    // unhandled before, so the promise escaped and the flag never cleared.
    await screen.findByText(/could not reach the server/i)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
