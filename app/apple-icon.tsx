// app/apple-icon.tsx — the iOS home-screen icon.
//
// Generated as a real PNG at build time via next/og. iOS needs a PNG for
// apple-touch-icon; without one it falls back to a screenshot of the page,
// which looks broken on the home screen.
//
// This is the logo's inner mark — circle plus CS — without the starburst rays.
// At the size iOS actually renders (roughly 60pt), the rays collapse into noise,
// so the icon drops them deliberately rather than shrinking the full logo.

import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
        }}
      >
        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: 116,
            border: '6px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          CS
        </div>
      </div>
    ),
    size
  )
}
