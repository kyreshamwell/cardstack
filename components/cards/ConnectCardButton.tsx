'use client'
// components/cards/ConnectCardButton.tsx
//
// This component opens Plaid Link — the widget where users pick their bank and log in.
//
// Why 'use client'?
//   react-plaid-link uses browser APIs (opens a popup/iframe).
//   Client components run in the browser. Server components don't.
//   Any component with interactivity or browser APIs needs 'use client'.
//
// Flow:
//   1. On mount: fetch a link_token from our API (server creates it)
//   2. User clicks "Connect a card" → Plaid Link opens
//   3. User picks bank, logs in
//   4. Plaid calls onSuccess with a public_token
//   5. We POST that to our exchange-token API → access_token saved, cards saved
//   6. Page reloads to show the new card

import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export function ConnectCardButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isExchanging, setIsExchanging] = useState(false)

  // Fetch the link token when the component mounts
  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => setLinkToken(data.link_token))
      .catch((err) => console.error('Failed to create link token:', err))
  }, [])

  // Called when the user successfully connects their bank
  const onSuccess = useCallback(async (publicToken: string) => {
    setIsExchanging(true)
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error('Exchange token failed:', data)
        alert(`Failed to connect card: ${data.error ?? 'Unknown error'}`)
        setIsExchanging(false)
        return
      }

      console.log('Card connected:', data)
      // Reload so the dashboard server component re-fetches from Supabase
      window.location.reload()
    } catch (err) {
      console.error('Failed to exchange token:', err)
      setIsExchanging(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  })

  return (
    <button
      onClick={() => open()}
      disabled={!ready || isExchanging}
      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExchanging ? 'Connecting...' : 'Connect a card'}
    </button>
  )
}
