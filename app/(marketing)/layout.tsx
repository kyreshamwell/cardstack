// app/(marketing)/layout.tsx
//
// Owns both public views. MarketingFrame renders the pitch AND the demo as two
// panels of one filmstrip and slides between them by pathname, so `children`
// is deliberately not rendered here — see the note at the top of that file for
// why both panels have to stay mounted.
//
// The pages under this layout still matter: they own the URLs, the metadata,
// and the signed-in redirect.

import { MarketingFrame } from '@/components/landing/MarketingFrame'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* One timestamp for the whole render. The demo's fixture dates are
          derived from it on both sides of hydration — computing them
          independently in the browser is what produced a mismatch. */}
      <MarketingFrame now={Date.now()} />
      {children}
    </>
  )
}
