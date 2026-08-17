// app/api/transactions/import/route.ts
//
// Inserts transactions parsed from a bank CSV.
//
// CSV rows land in the same table as Plaid ones, distinguished by source.
// plaid_transaction_id is NOT NULL UNIQUE, so imported rows get a deterministic
// synthetic ID built from their own contents — re-importing an overlapping file
// updates those rows instead of duplicating them.

import { auth } from '@clerk/nextjs/server'
import { supabaseForUser } from '@/lib/supabase'

interface IncomingRow {
  date: string
  description: string
  amount: number
}

// Caps on what one request may carry. Nothing here is a security boundary in
// the ownership sense — the caller is authenticated and can only write rows
// they own — but "authenticated" is not "trusted with unbounded writes". The
// body arrives as one JSON array and Next puts no default limit on it, so
// without these a single POST decides how much of the database it gets.
//
// Rejecting past the cap rather than truncating: a silent slice would import
// part of the file and report success, and the missing months would surface
// weeks later as a balance that doesn't reconcile. Ten years of a busy card is
// comfortably under this, so hitting it means something is wrong.
const MAX_ROWS = 10_000

// Longest description we'll store. Real ones run to about 100 characters;
// this is only here so the column can't be used as free storage.
const MAX_DESCRIPTION = 500

/** Stable ID for a CSV row — same row in, same ID out, so re-imports dedupe. */
function syntheticId(cardId: string, row: IncomingRow): string {
  const slug = row.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `csv:${cardId}:${row.date}:${row.amount.toFixed(2)}:${slug}`
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cardId?: unknown; rows?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Malformed request body' }, { status: 400 })
  }

  const { cardId, rows } = body as { cardId?: string; rows?: IncomingRow[] }

  if (typeof cardId !== 'string' || !cardId || !Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'Missing card or rows' }, { status: 400 })
  }

  if (rows.length > MAX_ROWS) {
    return Response.json(
      { error: `That file has ${rows.length.toLocaleString()} rows; the limit is ${MAX_ROWS.toLocaleString()} per import. Split it and import the halves.` },
      { status: 413 }
    )
  }

  const db = supabaseForUser()

  // Confirm the card belongs to this user before writing anything against it.
  const { data: card, error: cardError } = await db
    .from('cards')
    .select('id, plaid_account_id')
    .eq('id', cardId)
    .eq('user_id', userId)
    .maybeSingle()

  if (cardError || !card) {
    return Response.json({ error: 'Card not found' }, { status: 404 })
  }

  const valid = rows.filter(
    (r) =>
      typeof r.date === 'string' &&
      typeof r.amount === 'number' &&
      Number.isFinite(r.amount) &&
      typeof r.description === 'string' &&
      r.description.trim() !== ''
  )

  if (valid.length === 0) {
    return Response.json({ error: 'No readable rows' }, { status: 400 })
  }

  const payload = valid.map((r) => ({
    user_id: userId,
    card_id: cardId,
    plaid_transaction_id: syntheticId(cardId, r),
    // Manual cards have no Plaid account; fall back to the card's own id so the
    // NOT NULL column always has something meaningful in it.
    plaid_account_id: card.plaid_account_id ?? cardId,
    name: r.description.trim().slice(0, MAX_DESCRIPTION),
    merchant_name: null,
    amount: r.amount,
    transaction_date: r.date,
    pending: false,
    category: null,
    currency: 'USD',
    source: 'csv',
  }))

  const { error } = await db
    .from('transactions')
    .upsert(payload, { onConflict: 'plaid_transaction_id' })

  if (error) {
    console.error('CSV import failed:', error.message)
    return Response.json({ error: 'Failed to import rows' }, { status: 500 })
  }

  return Response.json({
    imported: payload.length,
    skipped: rows.length - valid.length,
  })
}
