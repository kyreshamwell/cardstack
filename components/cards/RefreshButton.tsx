'use client'
// components/cards/RefreshButton.tsx
//
// Calls /api/plaid/sync to re-fetch the latest balances from Plaid,
// then reloads the page so the server component re-reads from Supabase.
//
// Why is this a client component?
//   It needs onClick and loading state — both require interactivity.
//   The actual data fetching still happens server-side in the API route.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RefreshButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRefresh() {
    setLoading(true)
    try {
      await fetch('/api/plaid/sync', { method: 'POST' })
      // router.refresh() re-runs server components without a full page reload
      router.refresh()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Spinning icon when loading */}
      <svg
        className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
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
      {loading ? 'Refreshing...' : 'Refresh'}
    </button>
  )
}
