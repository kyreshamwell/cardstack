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

  const isProduction = process.env.PLAID_ENV === 'production'

  const response = await plaidClient.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: 'Cardstack',
    products: [Products.Auth],
    optional_products: [Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: 'en',
    // redirect_uri is required in production for OAuth institutions (Chase, BofA, etc.)
    // Must exactly match a URI registered in your Plaid dashboard
    ...(isProduction && {
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    }),
  })

  return Response.json({ link_token: response.data.link_token })
}
