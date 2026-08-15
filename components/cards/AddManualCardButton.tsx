'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const empty = {
  name: '',
  institution_name: '',
  balance_current: '',
  balance_limit: '',
  due_date: '',
  minimum_payment: '',
}

export function AddManualCardButton() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function set(field: keyof typeof empty, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function close() {
    setOpen(false)
    setForm(empty)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.balance_current || !form.balance_limit) {
      setError('Card name, balance, and limit are required.')
      return
    }

    setSaving(true)
    setError('')

    // Reset in `finally`: router.refresh() does not unmount this component, so
    // clearing `saving` only on the error path left the button stuck reading
    // "Saving…" the next time the dialog was opened.
    try {
      const res = await fetch('/api/cards/add-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          institution_name: form.institution_name.trim(),
          balance_current: parseFloat(form.balance_current),
          balance_limit: parseFloat(form.balance_limit),
          due_date: form.due_date || null,
          minimum_payment: form.minimum_payment ? parseFloat(form.minimum_payment) : null,
        }),
      })

      if (res.ok) {
        close()
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to add card.')
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-ground px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-raised hover:text-ink transition-colors"
      >
        + Add manually
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-ground shadow-xl">
            {/* Header */}
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-semibold text-ink">Add card manually</h2>
              <p className="mt-0.5 text-sm text-ink-2">
                For cards that can&apos;t connect via Plaid.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Card name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                  Card name <span className="text-critical">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amazon Store Card"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
                />
              </div>

              {/* Institution */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                  Bank / Issuer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Synchrony Bank"
                  value={form.institution_name}
                  onChange={(e) => set('institution_name', e.target.value)}
                  className="w-full rounded-lg border border-line bg-ground px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 focus:outline-none"
                />
              </div>

              {/* Balance + Limit side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Balance <span className="text-critical">*</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-line bg-ground px-3 py-2 focus-within:border-line-2">
                    <span className="text-sm text-ink-3 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.balance_current}
                      onChange={(e) => set('balance_current', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">
                    Credit limit <span className="text-critical">*</span>
                  </label>
                  <div className="flex items-center rounded-lg border border-line bg-ground px-3 py-2 focus-within:border-line-2">
                    <span className="text-sm text-ink-3 mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.balance_limit}
                      onChange={(e) => set('balance_limit', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Due date + Min payment side by side */}
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
                      placeholder="0.00"
                      value={form.minimum_payment}
                      onChange={(e) => set('minimum_payment', e.target.value)}
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-critical">{error}</p>}

              {/* Actions */}
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
                  {saving ? 'Saving…' : 'Add card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
