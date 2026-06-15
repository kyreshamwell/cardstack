'use client'
// components/cards/RemoveCardButton.tsx
//
// Shows a remove button that asks for confirmation before deleting.
// Uses window.confirm for now — simple, no extra UI needed.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  cardId: string
  cardName: string
}

export function RemoveCardButton({ cardId, cardName }: Props) {
  const [removing, setRemoving] = useState(false)
  const router = useRouter()

  async function handleRemove() {
    const confirmed = window.confirm(
      `Remove "${cardName}" from your dashboard? This cannot be undone.`
    )
    if (!confirmed) return

    setRemoving(true)
    const res = await fetch('/api/cards/remove', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId }),
    })

    if (res.ok) {
      router.refresh()
    } else {
      alert('Failed to remove card. Please try again.')
      setRemoving(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={removing}
      title="Remove card"
      className="text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {removing ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  )
}
