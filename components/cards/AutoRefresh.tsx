'use client'
// components/cards/AutoRefresh.tsx
//
// Renders nothing. Syncs on load when the data has gone stale, so the dashboard
// doesn't sit showing hours-old balances until you remember to hit Refresh.
//
// Why a threshold instead of syncing every visit:
//   /accounts/balance/get pulls live from the bank on every call — that's the
//   whole reason balances are accurate now. It's also slow and rate-limited per
//   Item, so firing it on every render (including every router.refresh()) would
//   hammer the institution and eventually get throttled. Thirty minutes keeps
//   things current without abusing the connection.
//
// This only runs while the dashboard is open. Keeping data warm when nobody is
// looking is a cron job's job, not the browser's.

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const STALE_AFTER_MINUTES = 30

interface Props {
  lastSyncedAt: string | null
}

export function AutoRefresh({ lastSyncedAt }: Props) {
  const started = useRef(false)
  const router = useRouter()

  useEffect(() => {
    // Guard against StrictMode's double-invoke and against re-firing when
    // router.refresh() re-renders this component.
    if (started.current) return

    const ageMinutes = lastSyncedAt
      ? (Date.now() - new Date(lastSyncedAt).getTime()) / 60_000
      : Number.POSITIVE_INFINITY

    if (ageMinutes < STALE_AFTER_MINUTES) return

    started.current = true

    void (async () => {
      try {
        await Promise.all([
          fetch('/api/plaid/sync', { method: 'POST' }),
          fetch('/api/plaid/sync-transactions', { method: 'POST' }),
        ])
        // Recurring detection reads transaction history, so it follows the
        // transaction sync rather than running beside it.
        await fetch('/api/plaid/sync-recurring', { method: 'POST' })
        router.refresh()
      } catch {
        // A failed background sync is not worth interrupting anyone over — the
        // Refresh button surfaces real errors when pressed deliberately.
      }
    })()
  }, [lastSyncedAt, router])

  return null
}
