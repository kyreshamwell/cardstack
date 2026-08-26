'use client'
// components/cards/RefreshButton.tsx
//
// Calls /api/plaid/sync to re-fetch the latest balances from Plaid,
// then reloads the page so the server component re-reads from Supabase.
//
// Why is this a client component?
//   It needs onClick and loading state, and both require interactivity.
//   The actual data fetching still happens server-side in the API route.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Failure = {
  institution: string
  code: string
  needsReauth: boolean
}

export function RefreshButton() {
  const [loading, setLoading] = useState(false)
  const [failures, setFailures] = useState<Failure[]>([])
  const router = useRouter()

  async function handleRefresh() {
    setLoading(true)
    setFailures([])
    try {
      // Balances, transactions, and recurring charges refresh together:
      // one button, one action.
      const [balanceRes, txRes] = await Promise.all([
        fetch('/api/plaid/sync', { method: 'POST' }),
        fetch('/api/plaid/sync-transactions', { method: 'POST' }),
      ])

      const balanceData = await balanceRes.json()
      const txData = await txRes.json().catch(() => ({}))

      // Recurring detection reads transaction history, so it runs after the
      // transaction sync rather than alongside it. A failure here is not worth
      // interrupting the user over. The charges list just stays as it was.
      fetch('/api/plaid/sync-recurring', { method: 'POST' })
        .then(() => router.refresh())
        .catch(() => {})

      const next: Failure[] = []

      if (!balanceRes.ok) {
        next.push({
          institution: 'Balances',
          code: balanceData.error ?? 'Request failed',
          needsReauth: false,
        })
      } else if (balanceData.failures?.length) {
        next.push(...balanceData.failures)
      }

      // Transaction failures are only worth surfacing here when they're real.
      // A bank that hasn't granted consent yet has its own prompt on the page,
      // and PRODUCT_NOT_READY just means Plaid is still building history.
      for (const f of txData.failures ?? []) {
        if (!f.needsConsent && !f.pending) {
          next.push({
            institution: `${f.institution} transactions`,
            code: f.code,
            needsReauth: false,
          })
        }
      }

      setFailures(next)

      // router.refresh() re-runs server components without a full page reload
      router.refresh()
    } catch (err) {
      console.error('Sync failed:', err)
      setFailures([{ institution: 'Sync', code: 'Network error', needsReauth: false }])
    } finally {
      setLoading(false)
    }
  }

  // Previously the response was discarded, so a bank that failed to sync looked
  // identical to a successful refresh. The spinner just stopped.
  const hasFailures = failures.length > 0
  const failureText = hasFailures
    ? failures
        .map((f) =>
          f.needsReauth
            ? `${f.institution}: reconnect required`
            : `${f.institution}: ${f.code}`
        )
        .join('\n')
    : ''

  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={loading}
        title={
          loading
            ? 'Refreshing...'
            : hasFailures
            ? `Some cards didn't update:\n${failureText}`
            : 'Refresh balances'
        }
        aria-label="Refresh balances"
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          hasFailures
            ? 'border-warning bg-warning-wash text-warning hover:opacity-80'
            : 'border-line bg-ground text-ink-2 hover:bg-raised hover:text-ink'
        }`}
      >
        <svg
          className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      {hasFailures && !loading && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning ring-2 ring-ground"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
