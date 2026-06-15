// app/api/plaid/create-link-token/route.ts
//
// Called by the "Connect a card" button before Plaid Link opens.
// Returns a short-lived link_token that initializes the Plaid UI widget.
//
// Why does a link token exist?
//   Plaid doesn't want your client_id/secret anywhere near the browser.
//   Instead: your server creates a token → passes it to the browser →
//   browser uses it to open Plaid Link. Token expires after 30 minutes.
//
// The user object tells Plaid which of YOUR users is connecting —
// it uses the Clerk userId so Plaid's logs are traceable per user.

import { auth } from '@clerk/nextjs/server'
import { plaidClient } from '@/lib/plaid'
import { Products, CountryCode } from 'plaid'
// Products.Liabilities intentionally not used until Phase 2 (due dates + minimum payments)

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const isHttps = appUrl.startsWith('https://')

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: 'Cardstack',
      products: [Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: 'en',
      // Only send redirect_uri when running over HTTPS (Vercel).
      // Plaid production rejects http:// — omitting it works fine for localhost.
      ...(isHttps && {
        redirect_uri: `${appUrl}/dashboard`,
      }),
    })

    return Response.json({ link_token: response.data.link_token })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Log the full Plaid error response so we can see the exact reason
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response: { data: unknown } }
      console.error('Plaid error details:', JSON.stringify(axiosErr.response.data, null, 2))
    }
    console.error('Plaid link token error:', err)
    return Response.json({ error: message }, { status: 500 })
  }
}
