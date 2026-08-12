'use client'

import { useEffect, useState } from 'react'

export function CardFocusManager() {
  const [focusedName, setFocusedName] = useState<string | null>(null)

  useEffect(() => {
    function onFocus(e: Event) {
      const { id, name } = (e as CustomEvent<{ id: string; name: string }>).detail
      setFocusedName(name)
      document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
        el.style.display = el.getAttribute('data-card-id') === id ? '' : 'none'
      })
    }

    window.addEventListener('card:focus', onFocus)
    return () => window.removeEventListener('card:focus', onFocus)
  }, [])

  function showAll() {
    setFocusedName(null)
    document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      el.style.display = ''
    })
  }

  if (!focusedName) return null

  return (
    <div className="flex items-center justify-between mb-3 rounded-xl bg-raised border border-line px-4 py-2.5">
      <p className="text-sm text-ink-2">
        Showing{' '}
        <span className="font-semibold text-ink">{focusedName}</span>
      </p>
      <button
        onClick={showAll}
        className="text-sm font-medium text-s1 hover:opacity-80"
      >
        Show all cards →
      </button>
    </div>
  )
}
