// components/DarkModeToggle.tsx
//
// Light/dark switch, shown on every public panel and in the signed-in app.
//
// It does NOT decide the initial theme — a blocking script in the root layout
// does that before first paint, reading the same two sources in the same order
// (a saved choice, else the device preference). Deciding it here would mean a
// white flash on every load for anyone on a dark device. This only syncs
// React's copy of the state so the icon matches, applies a manual choice, and
// keeps following the OS while no manual choice exists.

'use client'

import { useEffect, useState } from 'react'

type Mode = 'light' | 'dark'

function getSystemPreference(): Mode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyMode(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  // Keep Safari's top bar in sync with the app's dark mode (not the system
  // preference). #000000 because that's what --ground is in the dark theme —
  // this used to be the old slate #0f172a, so the browser chrome and the page
  // it framed were visibly different blacks.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#000000' : '#ffffff')
}

export function DarkModeToggle() {
  const [mode, setMode] = useState<Mode>('light')

  useEffect(() => {
    // The class is already correct — the blocking script in the root layout set
    // it before paint. This only syncs React's copy of the state so the icon
    // matches, and re-applies to cover the theme-color meta tag.
    const saved = localStorage.getItem('theme') as Mode | null
    const initial = saved ?? getSystemPreference()
    setMode(initial)
    applyMode(initial)

    // Keep in sync if user changes their OS theme (only when no manual override)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const next: Mode = e.matches ? 'dark' : 'light'
        setMode(next)
        applyMode(next)
      }
    }
    mq.addEventListener('change', onSystemChange)
    return () => mq.removeEventListener('change', onSystemChange)
  }, [])

  function toggle() {
    const next: Mode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyMode(next)
    localStorage.setItem('theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-ground px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-raised transition-colors"
    >
      {mode === 'dark' ? (
        /* Sun — switch to light */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        /* Moon — switch to dark */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
