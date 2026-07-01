'use client'

import { useEffect, useState } from 'react'

interface Props {
  webUrl: string
  appLink: string | null
  accentColor: string
}

export function PayCardButton({ webUrl, appLink, accentColor }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
  }, [])

  function handleClick() {
    if (isMobile && appLink) {
      // Try opening the native app. If the OS doesn't handle the scheme within
      // 1.2 s (app not installed), fall back to the bank's website.
      let appOpened = false
      const fallback = setTimeout(() => {
        if (!appOpened) window.location.href = webUrl
      }, 1200)
      window.addEventListener('blur', () => {
        appOpened = true
        clearTimeout(fallback)
      }, { once: true })
      window.location.href = appLink
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="mt-1 block w-full rounded-lg py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
      style={{ backgroundColor: accentColor }}
    >
      {isMobile && appLink ? 'Open app to pay →' : 'Pay this card →'}
    </button>
  )
}
