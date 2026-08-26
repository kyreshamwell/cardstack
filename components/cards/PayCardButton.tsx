// components/cards/PayCardButton.tsx
//
// Sends you to the bank to actually pay: their app on a phone, their website
// otherwise.
//
// The OS gives no reliable answer to "is this app installed", so opening the
// app scheme and falling back on a timer is the standard approach: if the app
// opens the tab loses focus and the fallback is cancelled; if nothing happens
// the timer fires and the website loads.
//
// Device detection is by user agent, not viewport width. A narrow desktop
// window is not a phone and has no app to open.
//
// NOTE: the demo renders a dead lookalike instead of this. Sending a sample
// visitor to a real bank from fixture data isn't ours to do.

'use client'

import { useEffect, useState } from 'react'

interface Props {
  webUrl: string
  appScheme?: string
  accentColor: string
}

// Detects the actual device OS via user agent, not viewport width, so
// resizing a desktop browser window never counts as "mobile" here.
function isRealMobileDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function PayCardButton({ webUrl, appScheme, accentColor }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(isRealMobileDevice())
  }, [])

  function handleClick(e: React.MouseEvent) {
    if (isMobile && appScheme) {
      e.preventDefault()
      // Try the app first. If it's not installed, iOS silently does nothing
      // and the page keeps running, so this timeout falls back to the website.
      // If the app DOES open, the tab loses focus and we cancel the fallback.
      const fallback = setTimeout(() => {
        window.location.href = webUrl
      }, 1200)
      window.addEventListener('blur', () => clearTimeout(fallback), { once: true })
      window.location.href = appScheme
    }
    // No appScheme (or not on a real phone): let the <a> navigate normally.
  }

  return (
    <a
      href={webUrl}
      onClick={handleClick}
      target={isMobile && appScheme ? undefined : '_blank'}
      rel="noopener noreferrer"
      className="mt-1 block w-full rounded-lg py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
      style={{ backgroundColor: accentColor }}
    >
      {isMobile && appScheme ? 'Open app to pay →' : 'Pay this card →'}
    </a>
  )
}
