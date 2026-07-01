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
    <div className="flex items-center justify-between mb-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Showing{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{focusedName}</span>
      </p>
      <button
        onClick={showAll}
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
      >
        Show all cards →
      </button>
    </div>
  )
}
