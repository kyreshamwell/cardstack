// app/api/plaid/sync-recurring/route.ts
//
// Pulls recurring charge streams from Plaid into recurring_charges.
//
// Plaid derives these from transaction history, so this needs the Transactions
// product and enough history to spot a pattern. A brand-new connection will
// return few or no streams until Plaid has seen a couple of cycles. Streams
// with status EARLY_DETECTION are Plaid's low-confidence guesses.
//
// We only keep OUTFLOW streams: money leaving the card (subscriptions and other
// repeating charges). Inflow on a credit card is payments and refunds, which
// the transaction list already covers.

// Two clients, split by table: connected_accounts stays on supabaseAdmin
// because it stores plaid_access_token; cards and recurring_charges go through
// supabaseForUser() so RLS enforces ownership in the database.
// See docs/migrations/001-rls-write-policies.sql.

import { auth } from '@clerk/nextjs/server'
import { plaidClient, plaidErrorCode, plaidErrorCodeOrNull } from '@/lib/plaid'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase'

type Connection = {
  id: string
  plaid_access_token: string
  institution_name: string | null
}

type SyncResult =
  | { ok: true; institution: string; found: number }
  | { ok: false; institution: string; code: string }

async function syncOne(conn: Connection, userId: string): Promise<SyncResult> {
  const institution = conn.institution_name ?? 'Bank'
  const db = supabaseForUser()

  try {
    const { data: cards } = await db
      .from('cards')
      .select('id, plaid_account_id')
      .eq('connected_account_id', conn.id)
      .eq('user_id', userId)

    const cardByAccount = new Map<string, string>()
    for (const c of cards ?? []) {
      if (c.plaid_account_id) cardByAccount.set(c.plaid_account_id, c.id)
    }

    // No tracked cards on this connection, so nothing to attribute streams to.
    if (cardByAccount.size === 0) {
      return { ok: true, institution, found: 0 }
    }

    const res = await plaidClient.transactionsRecurringGet({
      access_token: conn.plaid_access_token,
      account_ids: [...cardByAccount.keys()],
    })

    const rows = res.data.outflow_streams
      .filter((s) => cardByAccount.has(s.account_id))
      .map((s) => ({
        user_id: userId,
        card_id: cardByAccount.get(s.account_id)!,
        plaid_stream_id: s.stream_id,
        plaid_account_id: s.account_id,
        description: s.description,
        merchant_name: s.merchant_name ?? null,
        frequency: s.frequency,
        // average_amount / last_amount arrive as { amount, iso_currency_code }
        average_amount: s.average_amount?.amount ?? null,
        last_amount: s.last_amount?.amount ?? null,
        last_date: s.last_date,
        predicted_next_date: s.predicted_next_date ?? null,
        is_active: s.is_active,
        status: s.status,
        category: s.personal_finance_category?.primary ?? null,
        updated_at: new Date().toISOString(),
      }))

    if (rows.length > 0) {
      const { error } = await db
        .from('recurring_charges')
        .upsert(rows, { onConflict: 'plaid_stream_id' })
      if (error) throw new Error(`Upsert failed: ${error.message}`)
    }

    return { ok: true, institution, found: rows.length }
  } catch (err: unknown) {
    console.error(`Recurring sync failed for ${institution}: ${plaidErrorCode(err)}`)
    // Full detail logged above; only Plaid's public codes travel to the client.
    const code = plaidErrorCodeOrNull(err) ?? 'SYNC_FAILED'
    return { ok: false, institution, code }
  }
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only connections that have granted Transactions consent can return streams.
  const { data: connections, error } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, plaid_access_token, institution_name')
    .eq('user_id', userId)
    .eq('transactions_enabled', true)

  if (error || !connections) {
    return Response.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }

  const results = await Promise.all(
    connections.map((c) => syncOne(c as Connection, userId))
  )

  const failures = results.filter(
    (r): r is Extract<SyncResult, { ok: false }> => !r.ok
  )
  const succeeded = results.filter(
    (r): r is Extract<SyncResult, { ok: true }> => r.ok
  )

  return Response.json({
    synced: succeeded.length,
    found: succeeded.reduce((s, r) => s + r.found, 0),
    failed: failures.length,
    failures: failures.map((f) => ({ institution: f.institution, code: f.code })),
  })
}
