// app/api/transactions/import/route.ts
//
// Inserts transactions parsed from a bank CSV.
//
// CSV rows land in the same table as Plaid ones, distinguished by source.
// plaid_transaction_id is NOT NULL UNIQUE, so imported rows get a deterministic
// synthetic ID built from their own contents — re-importing an overlapping file
// updates those rows instead of duplicating them.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

interface IncomingRow {
  date: string
  description: string
  amount: number
}

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

  const { cardId, rows } = (await request.json()) as {
    cardId?: string
    rows?: IncomingRow[]
  }

  if (!cardId || !Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'Missing card or rows' }, { status: 400 })
  }

  // Confirm the card belongs to this user before writing anything against it.
  const { data: card, error: cardError } = await supabaseAdmin
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
    name: r.description.trim(),
    merchant_name: null,
    amount: r.amount,
    transaction_date: r.date,
    pending: false,
    category: null,
    currency: 'USD',
    source: 'csv',
  }))

  const { error } = await supabaseAdmin
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
