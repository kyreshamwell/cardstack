// app/api/plaid/sync/route.ts
//
// Re-fetches the latest balances from Plaid for all connected accounts
// and updates the cards table in Supabase.
//
// When to call this:
//   - When the user visits the dashboard (to show fresh data)
//   - On a schedule (we'll add a cron job later to keep data fresh)
//   - After a manual "Refresh" button click
//
// This route never touches the client with sensitive data —
// it reads access_tokens from Supabase server-side, calls Plaid,
// and writes results back to Supabase.

import { auth } from '@clerk/nextjs/server'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all connected accounts for this user
  const { data: connections, error: connectionsError } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, plaid_access_token')
    .eq('user_id', userId)

  if (connectionsError || !connections) {
    return Response.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }

  // For each connection, fetch latest balances and liabilities from Plaid
  let synced = 0
  let failed = 0

  for (const connection of connections) {
    const accessToken = connection.plaid_access_token

    try {
      // Update balances
      const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken })
      for (const account of accountsResponse.data.accounts) {
        await supabaseAdmin
          .from('cards')
          .update({
            balance_current: account.balances.current,
            balance_available: account.balances.available,
            balance_limit: account.balances.limit,
            last_synced_at: new Date().toISOString(),
          })
          .eq('plaid_account_id', account.account_id)
          .eq('user_id', userId)
      }

      // Update due dates + payment info (if institution supports Liabilities)
      try {
        const liabilitiesResponse = await plaidClient.liabilitiesGet({ access_token: accessToken })
        const creditLiabilities = liabilitiesResponse.data.liabilities.credit ?? []

        for (const liability of creditLiabilities) {
          await supabaseAdmin
            .from('cards')
            .update({
              due_date: liability.next_payment_due_date ?? null,
              minimum_payment: liability.minimum_payment_amount ?? null,
              last_payment_amount: liability.last_payment_amount ?? null,
              last_payment_date: liability.last_payment_date ?? null,
              is_overdue: liability.is_overdue ?? false,
            })
            .eq('plaid_account_id', liability.account_id)
            .eq('user_id', userId)
        }
      } catch {
        // Institution doesn't support Liabilities — skip, balances already updated
      }

      synced++
    } catch (err: unknown) {
      // Token expired, item needs re-auth, or institution error — skip this connection
      const status = (err as { response?: { data?: { error_code?: string } } })
        ?.response?.data?.error_code
      console.error(`Sync failed for connection ${connection.id}: ${status ?? 'unknown error'}`)
      failed++
    }
  }

  return Response.json({ success: true, synced, failed })
}
