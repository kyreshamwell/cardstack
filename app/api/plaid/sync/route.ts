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
// This route never touches the client with sensitive data.
// It reads access_tokens from Supabase server-side, calls Plaid,
// and writes results back to Supabase.
//
// Two clients, split by table:
//   connected_accounts → supabaseAdmin, because it stores plaid_access_token
//     and that column must never be readable by the user-level Postgres role
//   cards              → supabaseForUser(), so RLS enforces ownership
// The reasoning is spelled out in docs/migrations/001-rls-write-policies.sql.

import { auth } from '@clerk/nextjs/server'
import { plaidClient, plaidErrorCode, plaidErrorCodeOrNull } from '@/lib/plaid'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase'
import type { CreditCardLiability } from 'plaid'
import { shouldKeepExistingLimit } from '@/lib/cards'

type Connection = {
  id: string
  plaid_access_token: string
  institution_name: string | null
}

type SyncResult =
  | { ok: true; institution: string }
  | { ok: false; institution: string; code: string; needsReauth: boolean }

async function syncConnection(conn: Connection, userId: string): Promise<SyncResult> {
  const institution = conn.institution_name ?? 'Bank'
  const db = supabaseForUser()

  try {
    // accountsBalanceGet, NOT accountsGet. accountsGet returns Plaid's cached
    // copy of the balances, so hitting refresh would hand back the same stale
    // numbers. accountsBalanceGet forces a live pull from the institution.
    const balances = await plaidClient.accountsBalanceGet({
      access_token: conn.plaid_access_token,
    })

    // Liabilities (due dates, minimum payments) is optional, and not every
    // institution supports it. A failure here must not lose the balances above.
    const liabilities = new Map<string, CreditCardLiability>()
    try {
      const res = await plaidClient.liabilitiesGet({
        access_token: conn.plaid_access_token,
      })
      for (const l of res.data.liabilities.credit ?? []) {
        if (l.account_id) liabilities.set(l.account_id, l)
      }
    } catch {
      // Institution doesn't expose Liabilities. Balances still written below.
    }

    // Which of these cards carry a user-entered limit, so we don't overwrite it.
    const { data: existing } = await db
      .from('cards')
      .select('plaid_account_id, limit_is_manual')
      .eq('connected_account_id', conn.id)
      .eq('user_id', userId)

    const manualLimit = new Set(
      (existing ?? [])
        .filter((c) => c.limit_is_manual && c.plaid_account_id)
        .map((c) => c.plaid_account_id as string)
    )

    const syncedAt = new Date().toISOString()

    // One write per account carrying balances and liabilities together.
    // Previously this was two sequential writes per card, awaited in a loop.
    await Promise.all(
      balances.data.accounts.map((account) => {
        const l = liabilities.get(account.account_id)
        const keepLimit = shouldKeepExistingLimit(
          account.balances.limit,
          manualLimit.has(account.account_id)
        )

        return db
          .from('cards')
          .update({
            balance_current: account.balances.current,
            balance_available: account.balances.available,
            ...(keepLimit ? {} : { balance_limit: account.balances.limit }),
            last_synced_at: syncedAt,
            ...(l && {
              due_date: l.next_payment_due_date ?? null,
              minimum_payment: l.minimum_payment_amount ?? null,
              last_payment_amount: l.last_payment_amount ?? null,
              last_payment_date: l.last_payment_date ?? null,
              is_overdue: l.is_overdue ?? false,
              // What's actually owed to avoid interest. balance_current also
              // includes post-statement charges, which aren't due yet.
              statement_balance: l.last_statement_balance ?? null,
              statement_date: l.last_statement_issue_date ?? null,
            }),
          })
          .eq('plaid_account_id', account.account_id)
          .eq('user_id', userId)
      })
    )

    return { ok: true, institution }
  } catch (err: unknown) {
    console.error(
      `Sync failed for connection ${conn.id} (${institution}): ${plaidErrorCode(err)}`
    )
    // Full detail logged above; only Plaid's public codes travel to the client.
    const code = plaidErrorCodeOrNull(err) ?? 'SYNC_FAILED'
    return {
      ok: false,
      institution,
      code,
      // The user has to re-authenticate with the bank to fix this one.
      // Retrying the sync will never clear it.
      needsReauth: code === 'ITEM_LOGIN_REQUIRED',
    }
  }
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error: connectionsError } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, plaid_access_token, institution_name')
    .eq('user_id', userId)

  if (connectionsError || !connections) {
    return Response.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }

  // Connections sync in parallel. Serially, refresh time scaled with the number
  // of connected banks: two Plaid round-trips each, one after another.
  const results = await Promise.all(
    connections.map((c) => syncConnection(c as Connection, userId))
  )

  const failures = results.filter(
    (r): r is Extract<SyncResult, { ok: false }> => !r.ok
  )

  return Response.json({
    synced: results.length - failures.length,
    failed: failures.length,
    syncedAt: new Date().toISOString(),
    failures: failures.map((f) => ({
      institution: f.institution,
      code: f.code,
      needsReauth: f.needsReauth,
    })),
  })
}
