// tests/components/DashboardView.test.tsx
//
// DashboardView is the single view behind BOTH the real dashboard and the
// public demo: the real page passes Supabase rows, the demo passes fixtures.
// That's what stops the demo drifting from the app, so the props that differ
// between them are the ones worth pinning.
//
// It also renders two completely different layouts: a fixed-viewport grid on
// desktop, and tabs on phones where that grid collapses into itself. Which one
// appears is decided by `matchMedia`, so these tests drive it directly.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { buildDemoData } from '@/lib/demo-data'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const NOW = new Date('2026-08-14T15:00:00').getTime()

/** Points `matchMedia` at the phone layout (or back at the desktop grid). */
function setViewport(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function renderView(props: Partial<Parameters<typeof DashboardView>[0]> = {}) {
  const data = buildDemoData(NOW)
  return render(
    <DashboardView
      cardNameById={data.cardNames}
      cards={data.cards}
      colorById={data.colors}
      lastSyncedAt={data.lastSynced}
      lastViewedAt={data.lastViewed}
      recurring={data.recurring}
      transactions={data.transactions}
      {...props}
    />
  )
}

beforeEach(() => {
  setViewport(false)
})

describe('the utilization section', () => {
  it('is named for its outcome, not its mechanic', () => {
    // Renamed from "Pay before close", which said when to act but never what
    // for. The figure beneath it sits alongside a minimum payment and a
    // statement balance for the same card, and read as a bill.
    renderView()

    expect(screen.getByText('Lower reported utilization')).toBeInTheDocument()
    expect(screen.queryByText('Pay before close')).not.toBeInTheDocument()
  })

  it('shows where a payment would land the card, not just where it is', () => {
    // `77% → 30%` is the only thing marking the amount as a utilization move.
    renderView()

    expect(screen.getByText(/%\s*→\s*30%/)).toBeInTheDocument()
  })
})

describe('the `explain` prop', () => {
  const EXPLAINER = /Utilization reports when a statement closes/

  it('is off by default, so the real dashboard stays uncluttered', () => {
    renderView()

    expect(screen.queryByText(EXPLAINER)).not.toBeInTheDocument()
    // The section itself is still there. Only the teaching line is dropped.
    expect(screen.getByText('Lower reported utilization')).toBeInTheDocument()
  })

  it('explains itself in the demo, where the reader is new to the product', () => {
    renderView({ explain: true })

    expect(screen.getByText(EXPLAINER)).toBeInTheDocument()
  })
})

describe('the phone layout', () => {
  beforeEach(() => {
    setViewport(true)
  })

  it('becomes tabs', () => {
    renderView()

    expect(screen.getByRole('tab', { name: 'Cards' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Insights' })).toBeInTheDocument()
  })

  it('keeps the balance out of the tabs', () => {
    // The one number worth seeing without having to choose to look for it.
    renderView()

    expect(screen.getByText('Statement balance')).toBeInTheDocument()
  })

  it('shows one region at a time', async () => {
    const user = userEvent.setup()
    const { container } = renderView()

    expect(container.querySelectorAll('[data-card-id]').length).toBe(5)

    await user.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(container.querySelectorAll('[data-card-id]').length).toBe(0)
    expect(screen.getByText('Recent activity')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Insights' }))
    expect(screen.getByText('Lower reported utilization')).toBeInTheDocument()
  })

  it('drops the section labels the tab bar already provides', () => {
    // "YOUR CARDS" under a tab that says "Cards" costs a row and says nothing.
    // The desktop grid has no tab bar, so it keeps them.
    renderView()

    const tablist = screen.getByRole('tablist')
    expect(within(tablist).getByText('Cards')).toBeInTheDocument()
    expect(screen.queryByText('Your cards')).not.toBeInTheDocument()
  })

  it('brings you to the rows when a card is focused from the chart', async () => {
    // The chart lives in Insights and the rows live in Cards, so isolating a
    // card has to switch tabs or it appears to do nothing at all.
    const user = userEvent.setup()
    const { container } = renderView()

    await user.click(screen.getByRole('tab', { name: 'Insights' }))
    expect(container.querySelectorAll('[data-card-id]').length).toBe(0)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('card:focus', {
          detail: { id: 'demo-sapphire', name: 'Sapphire Preferred' },
        })
      )
    })

    expect(screen.getByRole('tab', { name: 'Cards' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    // And the filter actually applied, despite the rows not existing in the DOM
    // at the moment the event fired. CardFocusManager applies in an effect for
    // exactly this reason, so the assertion has to wait for that effect rather
    // than read straight after the dispatch.
    await waitFor(() => {
      const visible = [...container.querySelectorAll<HTMLElement>('[data-card-id]')].filter(
        (el) => el.style.display !== 'none'
      )
      expect(visible.map((el) => el.getAttribute('data-card-id'))).toEqual(['demo-sapphire'])
    })
  })
})

describe('the desktop layout', () => {
  it('shows every region at once, with no tabs', () => {
    const { container } = renderView()

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('Your cards')).toBeInTheDocument()
    expect(screen.getByText('Recent activity')).toBeInTheDocument()
    expect(screen.getByText('Recurring')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-card-id]').length).toBe(5)
  })

  it('renders the empty state instead when there are no cards', () => {
    renderView({ cards: [], emptyState: <p>No cards yet.</p> })

    expect(screen.getByText('No cards yet.')).toBeInTheDocument()
    expect(screen.queryByText('Your cards')).not.toBeInTheDocument()
  })
})
