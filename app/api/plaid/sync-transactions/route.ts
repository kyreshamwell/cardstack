// app/api/plaid/sync-transactions/route.ts
//
// Pulls transactions from Plaid into the transactions table.
//
// Why cursor-based?
//   /transactions/sync returns only what changed since the cursor we last
//   stored — added, modified, and removed — instead of re-downloading history
//   on every call. We persist next_cursor on the connection and pass it back
//   next time. First run has no cursor, so Plaid sends everything it has.
//
// Removed transactions are real: a pending charge gets replaced by the posted
// version, and Plaid tells us to delete the pending row.

import { auth } from '@clerk/nextjs/server'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin } from '@/lib/supabase'
import type { Transaction } from 'plaid'

type Connection = {
  id: string
  plaid_access_token: string
  institution_name: string | null
  transactions_cursor: string | null
}

type SyncResult =
  | { ok: true; institution: string; added: number; removed: number }
  | { ok: false; institution: string; code: string; needsConsent: boolean; pending: boolean }

// Plaid tells us to re-run shortly rather than treating these as failures.
const NOT_READY = 'PRODUCT_NOT_READY'
const CONSENT_CODES = [
  'ADDITIONAL_CONSENT_REQUIRED',
  'INSUFFICIENT_CREDENTIALS',
  'PRODUCTS_NOT_SUPPORTED',
  'INVALID_PRODUCT',
]

function errorCode(err: unknown): string {
  const fromPlaid = (err as { response?: { data?: { error_code?: string } } })
    ?.response?.data?.error_code
  if (fromPlaid) return fromPlaid
  return err instanceof Error ? err.message : 'UNKNOWN_ERROR'
}

async function syncOne(conn: Connection, userId: string): Promise<SyncResult> {
  const institution = conn.institution_name ?? 'Bank'

  try {
    // Map Plaid account IDs to our card rows. Anything not in this map (a
    // checking account on the same login, say) is skipped — we only store
    // transactions for cards we actually track.
    const { data: cards } = await supabaseAdmin
      .from('cards')
      .select('id, plaid_account_id')
      .eq('connected_account_id', conn.id)
      .eq('user_id', userId)

    const cardByAccount = new Map<string, string>()
    for (const c of cards ?? []) {
      if (c.plaid_account_id) cardByAccount.set(c.plaid_account_id, c.id)
    }

    const added: Transaction[] = []
    const modified: Transaction[] = []
    const removedIds: string[] = []

    let cursor = conn.transactions_cursor ?? undefined
    let hasMore = true
    let pages = 0

    // Plaid paginates; keep going until has_more is false. The page cap is a
    // guard against an unexpected cursor loop, not an expected limit.
    while (hasMore && pages < 50) {
      const res = await plaidClient.transactionsSync({
        access_token: conn.plaid_access_token,
        cursor,
      })

      added.push(...res.data.added)
      modified.push(...res.data.modified)
      removedIds.push(...res.data.removed.map((r) => r.transaction_id))

      cursor = res.data.next_cursor
      hasMore = res.data.has_more
      pages++
    }

    const rows = [...added, ...modified]
      .filter((t) => cardByAccount.has(t.account_id))
      .map((t) => ({
        user_id: userId,
        card_id: cardByAccount.get(t.account_id)!,
        plaid_transaction_id: t.transaction_id,
        plaid_account_id: t.account_id,
        name: t.name,
        merchant_name: t.merchant_name ?? null,
        // Plaid sign convention: positive = money out (purchase).
        amount: t.amount,
        transaction_date: t.date,
        pending: t.pending ?? false,
        category: t.personal_finance_category?.primary ?? null,
        currency: t.iso_currency_code ?? 'USD',
      }))

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' })
      if (error) throw new Error(`Upsert failed: ${error.message}`)
    }

    if (removedIds.length > 0) {
      await supabaseAdmin
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .in('plaid_transaction_id', removedIds)
    }

    // Only advance the cursor once the writes above succeeded — otherwise a
    // failed write would be skipped forever on the next sync.
    await supabaseAdmin
      .from('connected_accounts')
      .update({ transactions_cursor: cursor, transactions_enabled: true })
      .eq('id', conn.id)
      .eq('user_id', userId)

    return { ok: true, institution, added: rows.length, removed: removedIds.length }
  } catch (err: unknown) {
    const code = errorCode(err)
    console.error(`Transaction sync failed for ${institution}: ${code}`)
    return {
      ok: false,
      institution,
      code,
      needsConsent: CONSENT_CODES.includes(code),
      pending: code === NOT_READY,
    }
  }
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: connections, error } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, plaid_access_token, institution_name, transactions_cursor')
    .eq('user_id', userId)

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
    imported: succeeded.reduce((s, r) => s + r.added, 0),
    failed: failures.length,
    failures: failures.map((f) => ({
      institution: f.institution,
      code: f.code,
      needsConsent: f.needsConsent,
      pending: f.pending,
    })),
  })
}
