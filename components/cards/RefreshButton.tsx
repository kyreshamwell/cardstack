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
      title={loading ? 'Refreshing...' : 'Refresh balances'}
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  )
}
