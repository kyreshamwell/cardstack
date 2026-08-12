'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export function ConnectCardButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isExchanging, setIsExchanging] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.link_token) {
          setLinkToken(data.link_token)
        } else {
          setTokenError(data.error ?? 'Unknown error')
        }
      })
      .catch((err) => {
        setTokenError(String(err))
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
        title={tokenError}
        className="rounded-lg bg-critical-wash border border-critical/40 px-3 py-2 text-sm font-medium text-critical cursor-not-allowed"
      >
        Config error
      </button>
    )
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || isExchanging}
      className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-ground hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExchanging ? 'Connecting...' : 'Connect a card'}
    </button>
  )
}
