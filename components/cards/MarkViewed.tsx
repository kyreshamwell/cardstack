'use client'
// components/cards/MarkViewed.tsx
//
// Renders nothing. Pings /api/viewed once on mount so the next visit knows
// where "new" starts.
//
// This runs AFTER the server component has already read the old timestamp and
// rendered the markers, so the write never erases the markers you're currently
// looking at.

import { useEffect, useRef } from 'react'

export function MarkViewed() {
  const sent = useRef(false)

  useEffect(() => {
    // React runs effects twice in dev StrictMode; the ref keeps it to one call.
    if (sent.current) return
    sent.current = true

    fetch('/api/viewed', { method: 'POST' }).catch(() => {
      // Non-critical — a missed ping just means the marker persists one more visit.
    })
  }, [])

  return null
}
