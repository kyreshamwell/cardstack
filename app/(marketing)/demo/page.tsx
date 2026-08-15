// app/(marketing)/demo/page.tsx — the demo as a real, public, linkable URL.
//
// Renders nothing for the same reason as `/`: the demo is a panel of the
// filmstrip in this group's layout. Arriving here — by link, bookmark, or
// Playwright — just puts the strip at its second position.
//
// Public on purpose. It runs entirely on fixture data and touches no account,
// and it's the only route that renders the real dashboard without credentials,
// which makes it the widest end-to-end coverage available for free.
//
// Signed-in users are NOT redirected away: the demo is what you show someone
// else without putting your own balances on screen.

export const metadata = {
  title: 'Cardstack — live demo',
  description: 'The real Cardstack dashboard, running on sample data.',
}

export default function DemoPage() {
  return null
}
