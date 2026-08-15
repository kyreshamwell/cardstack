'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface Props {
  cardId: string
  currentLimit: number | null
}

export function ManualLimitInput({ cardId, currentLimit }: Props) {
  const [editing, setEditing] = useState(currentLimit === null)
  const [value, setValue] = useState(currentLimit?.toString() ?? '')
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

    // Reset in `finally`: router.refresh() re-fetches server data without
    // unmounting this component, so state survives. Clearing `saving` only on
    // the error path left it true after a successful save, and re-opening the
    // editor showed a permanently disabled "..." button.
    try {
      const res = await fetch('/api/cards/update-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, limit }),
      })

      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to save')
      }
    } catch {
      setError('Could not reach the server')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="sensitive-value text-sm font-semibold text-ink">
          {currentLimit != null ? formatCurrency(currentLimit) : '—'}
        </span>
        <button
          onClick={() => setEditing(true)}
          title="Edit limit"
          className="text-ink-3 hover:text-ink-2 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex items-center gap-2">
        {currentLimit != null && (
          <button
            onClick={() => { setEditing(false); setValue(currentLimit.toString()); setError('') }}
            className="text-xs text-ink-3 hover:text-ink transition-colors"
          >
            Cancel
          </button>
        )}
        <span className="text-ink-3 text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Enter limit"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          className="w-24 rounded-md border border-line bg-ground px-2 py-1 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving || !value}
          className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-ground hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  )
}
