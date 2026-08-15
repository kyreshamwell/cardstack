// components/cards/CardFocusManager.tsx
//
// Isolates a single card when one is clicked in the balance chart, and offers
// the way back out.
//
// It listens on `window` rather than taking props because the chart and the
// card rows are far apart in the tree — the chart dispatches `card:focus` and
// this hides every `[data-card-id]` that doesn't match.
//
// Two things here are deliberate:
//
//   - The current selection is mirrored in a ref, because the listener is
//     registered once and would otherwise always read `null`. Without it, a
//     repeat click on the same card can't be told apart from a switch, and the
//     toggle-back-off behaviour is impossible.
//   - The filtering runs in an EFFECT, not in the handler. On the phone layout
//     the chart and the rows live on different tabs, so the rows aren't in the
//     DOM when the event fires; running after the commit means the tab switch
//     and the filter land together.

'use client'

import { useEffect, useRef, useState } from 'react'

interface Focused {
  id: string
  name: string
}

export function CardFocusManager() {
  const [focused, setFocused] = useState<Focused | null>(null)

  // The listener is registered once, so it can't read `focused` from the
  // closure — it would always see null. A ref carries the current value in so
  // a repeat click on the same card can be told apart from a switch.
  const focusedRef = useRef<Focused | null>(null)

  useEffect(() => {
    function onFocus(e: Event) {
      const { id, name } = (e as CustomEvent<Focused>).detail
      // Clicking the card that's already isolated is a toggle back to all
      // cards. Clicking a different one switches, it doesn't clear.
      const next = focusedRef.current?.id === id ? null : { id, name }
      focusedRef.current = next
      setFocused(next)
    }

    window.addEventListener('card:focus', onFocus)
    return () => window.removeEventListener('card:focus', onFocus)
  }, [])

  // Applied in an effect rather than inside the handler, which matters on the
  // phone layout: there the chart and the card list live in different tabs, so
  // the rows do not exist in the DOM at the moment the event fires. Running
  // after the commit means the tab switch and the filter land together —
  // handled imperatively, the focus was simply lost.
  useEffect(() => {
    const id = focused?.id ?? null
    document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      el.style.display = id === null || el.getAttribute('data-card-id') === id ? '' : 'none'
    })
  }, [focused])

  function showAll() {
    focusedRef.current = null
    setFocused(null)
    // The effect above restores the rows.
  }

  if (!focused) return null

  return (
    <div className="flex items-center justify-between mb-3 rounded-xl bg-raised border border-line px-4 py-2.5">
      <p className="text-sm text-ink-2">
        Showing{' '}
        <span className="font-semibold text-ink">{focused.name}</span>
      </p>
      <button
        onClick={showAll}
        className="text-sm font-medium text-s1 hover:opacity-80"
      >
        Show all cards →
      </button>
    </div>
  )
}
