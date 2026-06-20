'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export function ConnectCardButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isExchanging, setIsExchanging] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.link_token) {
          setLinkToken(data.link_token)
        } else {
          console.error('Plaid link token error:', data.error)
          setTokenError(true)
        }
      })
      .catch((err) => {
        console.error('Failed to create link token:', err)
        setTokenError(true)
      })
  }, [])

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

  if (tokenError) {
    return (
      <button
        disabled
        title="Plaid configuration error — check NEXT_PUBLIC_APP_URL and Plaid credentials in Vercel"
        className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm font-medium text-red-500 cursor-not-allowed"
      >
        Config error
      </button>
    )
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || isExchanging}
      className="rounded-lg bg-slate-900 dark:bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExchanging ? 'Connecting...' : 'Connect a card'}
    </button>
  )
}
