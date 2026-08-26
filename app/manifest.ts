// app/manifest.ts: the PWA manifest.
//
// Next.js serves this at /manifest.webmanifest from this file convention.
//
// Why bother: installing Cardstack to the home screen is what removes the
// "logging in is annoying" friction. A standalone PWA opens without browser
// chrome and keeps its own session, so it behaves like an app rather than a
// tab you have to find and re-authenticate.
//
// start_url points at /dashboard, not /: the installed app should open the
// app itself. A signed-out visitor still gets bounced to sign-in by middleware.

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cardstack',
    short_name: 'Cardstack',
    description: 'Your credit card command center.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        type: 'image/png',
        sizes: '180x180',
        purpose: 'any',
      },
    ],
  }
}
