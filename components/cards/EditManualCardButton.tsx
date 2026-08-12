'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  cardId: string
  cardName: string
  currentInstitution: string | null
  currentBalance: number | null
  currentLimit: number | null
  currentDueDate: string | null
  currentMinPayment: number | null
}

export function EditManualCardButton({
  cardId,
  cardName,
  currentInstitution,
  currentBalance,
  currentLimit,
  currentDueDate,
  currentMinPayment,
}: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: cardName,
    institution_name: currentInstitution ?? '',
    balance_current: currentBalance?.toString() ?? '',
    balance_limit: currentLimit?.toString() ?? '',
    due_date: currentDueDate ?? '',
    minimum_payment: currentMinPayment?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function close() {
    setOpen(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Card name is required.')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/cards/update-manual', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: cardId,
        name: form.name.trim(),
        institution_name: form.institution_name.trim(),
        balance_current: form.balance_current ? parseFloat(form.balance_current) : undefined,
        balance_limit: form.balance_limit ? parseFloat(form.balance_limit) : undefined,
        due_date: form.due_date,
        minimum_payment: form.minimum_payment,
      }),
    })

    if (res.ok) {
      close()
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to update card.')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit card"
        className="text-white/30 hover:text-white/80 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-sm rounded-2xl bg-ground shadow-xl">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-semibold text-ink">Edit card</h2>
              <p className="mt-0.5 text-sm text-ink-2">Update any details for this card.</p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                  Card name <span className="text-critical">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-sm text-ink focus:border-line-2 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                  Bank / Issuer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chase"
                  value={form.institution_name}
                  onChange={(e) => set('institution_name', e.target.value)}
                  className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Balance
                  </label>
                  <div className="flex items-center rounded-lg border border-line bg-ground px-3 py-2 focus-within:border-line-2">
                    <span className="text-sm text-ink-3 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.balance_current}
                      onChange={(e) => set('balance_current', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Limit
                  </label>
                  <div className="flex items-center rounded-lg border border-line bg-ground px-3 py-2 focus-within:border-line-2">
                    <span className="text-sm text-ink-3 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.balance_limit}
                      onChange={(e) => set('balance_limit', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => set('due_date', e.target.value)}
                    className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-sm text-ink focus:border-line-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Min. payment
                  </label>
                  <div className="flex items-center rounded-lg border border-line bg-ground px-3 py-2 focus-within:border-line-2">
                    <span className="text-sm text-ink-3 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.minimum_payment}
                      onChange={(e) => set('minimum_payment', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-critical">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-lg border border-line py-2 text-sm font-medium text-ink-2 hover:bg-raised transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-ink py-2 text-sm font-medium text-ground hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
