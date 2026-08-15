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
// Two modes:
//   - No body            → a normal link flow for connecting a NEW bank.
//   - { connectionId }   → UPDATE MODE for an existing connection, used to
//                          collect consent for Transactions on banks that were
//                          linked before we asked for it. Update mode reuses the
//                          same Item and access_token, so nothing is duplicated.
//
// Stays on supabaseAdmin deliberately. Its only query reads plaid_access_token
// from connected_accounts, which is exactly the column the user-level Postgres
// role must never see — so the .eq('user_id', …) below is the actual security
// boundary here, not belt and braces as it is elsewhere.
// See docs/migrations/001-rls-write-policies.sql.

import { auth } from '@clerk/nextjs/server'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin } from '@/lib/supabase'
import { Products, CountryCode } from 'plaid'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ConnectCardButton posts no body at all, so an empty parse is expected.
  let connectionId: string | undefined
  try {
    const body = await request.json()
    connectionId = body?.connectionId
  } catch {
    // no body — normal new-connection flow
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const isHttps = appUrl.startsWith('https://')

  const base = {
    user: { client_user_id: userId },
    client_name: 'Cardstack',
    country_codes: [CountryCode.Us],
    language: 'en',
    // Only send redirect_uri when running over HTTPS (Vercel).
    // Plaid production rejects http:// — omitting it works fine for localhost.
    ...(isHttps && { redirect_uri: `${appUrl}/dashboard` }),
  }

  try {
    // ── Update mode: add Transactions consent to an existing connection ────────
    if (connectionId) {
      const { data: connection, error } = await supabaseAdmin
        .from('connected_accounts')
        .select('plaid_access_token')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single()

      if (error || !connection) {
        return Response.json({ error: 'Connection not found' }, { status: 404 })
      }

      const response = await plaidClient.linkTokenCreate({
        ...base,
        // In update mode you pass access_token and must NOT pass `products`.
        access_token: connection.plaid_access_token,
        additional_consented_products: [Products.Transactions],
      })

      return Response.json({ link_token: response.data.link_token })
    }

    // ── Normal mode: connect a new bank ───────────────────────────────────────
    const response = await plaidClient.linkTokenCreate({
      ...base,
      products: [Products.Liabilities, Products.Transactions],
    })

    return Response.json({ link_token: response.data.link_token })
  } catch (err: unknown) {
    let plaidError: string = err instanceof Error ? err.message : String(err)
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response: { data: { error_code?: string; error_message?: string } } }
      const d = axiosErr.response?.data
      console.error('Plaid error details:', JSON.stringify(d, null, 2))
      if (d?.error_code) plaidError = `${d.error_code}: ${d.error_message ?? ''}`
    }
    console.error('Plaid link token error:', plaidError)
    return Response.json({ error: plaidError }, { status: 500 })
  }
}
