// tests/components/CardFocusManager.test.tsx
//
// Isolating a card is driven by a window event, not props. Both the pie
// wedges and the legend rows dispatch `card:focus`, and the manager hides
// every `[data-card-id]` element that doesn't match. The part that regresses
// silently is the toggle: clicking the focused card again has to clear, while
// clicking a DIFFERENT card has to switch rather than clear. Those two paths
// look identical from inside the handler unless it knows the current id.

import { describe, expect, it, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardFocusManager } from '@/components/cards/CardFocusManager'

/** The rows the manager reaches out and hides. It queries the whole document. */
function mountCardRows(ids: string[]) {
  const host = document.createElement('div')
  ids.forEach((id) => {
    const row = document.createElement('div')
    row.setAttribute('data-card-id', id)
    row.textContent = id
    host.appendChild(row)
  })
  document.body.appendChild(host)
  return host
}

function focus(id: string, name: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('card:focus', { detail: { id, name } }))
  })
}

/** ids of the rows still visible, in document order. */
function visible() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card-id]'))
    .filter((el) => el.style.display !== 'none')
    .map((el) => el.getAttribute('data-card-id'))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('CardFocusManager', () => {
  it('renders nothing until a card is focused', () => {
    mountCardRows(['a', 'b'])
    const { container } = render(<CardFocusManager />)

    expect(container).toBeEmptyDOMElement()
    expect(visible()).toEqual(['a', 'b'])
  })

  it('isolates the focused card and names it', () => {
    mountCardRows(['a', 'b', 'c'])
    render(<CardFocusManager />)

    focus('a', 'Amex Platinum')

    expect(visible()).toEqual(['a'])
    expect(screen.getByText('Amex Platinum')).toBeInTheDocument()
  })

  it('clicking the already-focused card clears the focus', () => {
    mountCardRows(['a', 'b', 'c'])
    const { container } = render(<CardFocusManager />)

    focus('a', 'Amex Platinum')
    focus('a', 'Amex Platinum')

    expect(visible()).toEqual(['a', 'b', 'c'])
    expect(container).toBeEmptyDOMElement()
  })

  it('clicking a different card switches focus instead of clearing', () => {
    mountCardRows(['a', 'b', 'c'])
    render(<CardFocusManager />)

    focus('a', 'Amex Platinum')
    focus('b', 'Chase Sapphire')

    expect(visible()).toEqual(['b'])
    expect(screen.getByText('Chase Sapphire')).toBeInTheDocument()
    expect(screen.queryByText('Amex Platinum')).not.toBeInTheDocument()
  })

  it('re-focusing after a toggle-off isolates again', () => {
    mountCardRows(['a', 'b'])
    render(<CardFocusManager />)

    focus('a', 'Amex Platinum')
    focus('a', 'Amex Platinum')
    focus('a', 'Amex Platinum')

    expect(visible()).toEqual(['a'])
  })

  it('"Show all cards" restores every row', async () => {
    const user = userEvent.setup()
    mountCardRows(['a', 'b', 'c'])
    const { container } = render(<CardFocusManager />)

    focus('a', 'Amex Platinum')
    await user.click(screen.getByRole('button', { name: /show all cards/i }))

    expect(visible()).toEqual(['a', 'b', 'c'])
    expect(container).toBeEmptyDOMElement()
  })

  it('a focus event after "Show all cards" isolates rather than toggling off', async () => {
    const user = userEvent.setup()
    mountCardRows(['a', 'b'])
    render(<CardFocusManager />)

    focus('a', 'Amex Platinum')
    await user.click(screen.getByRole('button', { name: /show all cards/i }))
    focus('a', 'Amex Platinum')

    expect(visible()).toEqual(['a'])
  })
})
