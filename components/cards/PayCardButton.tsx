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
      // On iOS Safari, navigate to the custom scheme.
      // If the app is installed, iOS intercepts it and opens the app.
      // If not, the browser ignores it or shows a "cannot open" alert —
      // we set a short timeout to fall back to the bank's website instead.
      const fallback = setTimeout(() => {
        window.location.href = webUrl
      }, 1500)

      // When the app opens, the page loses focus — clear the fallback so we
      // don't also navigate to the website.
      window.addEventListener('blur', () => clearTimeout(fallback), { once: true })
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
