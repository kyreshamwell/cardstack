'use client'
// components/cards/ManualLimitInput.tsx
//
// Only renders when Plaid didn't return a credit limit for a card.
// Lets the user enter their limit manually so utilization can be calculated.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  cardId: string
}

export function ManualLimitInput({ cardId }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSave() {
    const limit = parseFloat(value.replace(/[^0-9.]/g, ''))
    if (!limit || limit <= 0) {
      setError('Enter a valid limit')
      return
    }

    setSaving(true)
    setError('')

    const res = await fetch('/api/cards/update-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, limit }),
    })

    if (res.ok) {
      router.refresh() // re-renders server component with new limit
    } else {
      setError('Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Enter your limit"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !value}
          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
