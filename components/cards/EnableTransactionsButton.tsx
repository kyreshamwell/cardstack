'use client'
// components/cards/EnableTransactionsButton.tsx
//
// Sends the user through Plaid's UPDATE MODE to grant consent for Transactions
// on a bank that was connected before we asked for it.
//
// Update mode reuses the existing Item and access_token. No new connection is
// created, so cards and balances are untouched and nothing gets duplicated.

import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useRouter } from 'next/navigation'

interface Props {
  connectionId: string
  institutionName: string
}

export function EnableTransactionsButton({ connectionId, institutionName }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/plaid/create-link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.link_token) setLinkToken(d.link_token)
        else {
          setStatus('error')
          setMessage(d.error ?? 'Could not start Plaid')
        }
      })
      .catch((err) => {
        setStatus('error')
        setMessage(String(err))
      })
  }, [connectionId])

  const onSuccess = useCallback(async () => {
    setStatus('working')
    try {
      await fetch('/api/plaid/enable-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      const res = await fetch('/api/plaid/sync-transactions', { method: 'POST' })
      const data = await res.json()

      // Recurring streams are derived from transaction history, so this only
      // finds anything once Plaid has pulled some. Fire it and move on.
      fetch('/api/plaid/sync-recurring', { method: 'POST' }).catch(() => {})

      // Plaid is often still building the initial history at this point.
      const stillBuilding = data.failures?.some(
        (f: { pending: boolean }) => f.pending
      )
      if (stillBuilding) {
        setMessage('Connected. Plaid is still pulling history, check back in a minute.')
      }

      router.refresh()
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setMessage(String(err))
    }
  }, [connectionId, router])

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess })

  if (status === 'error') {
    return (
      <span
        title={message ?? undefined}
        className="text-xs font-medium text-critical"
      >
        Couldn&apos;t connect
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => open()}
        disabled={!ready || status === 'working'}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-ground hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'working' ? 'Enabling…' : `Enable for ${institutionName}`}
      </button>
      {message && <span className="text-xs text-ink-2">{message}</span>}
    </div>
  )
}
