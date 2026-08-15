// app/api/cards/remove/route.ts
//
// Deletes a card from Supabase. If it was the last card from that bank
// connection, also deletes the connected_accounts row.
//
// This route uses BOTH clients, and the split is deliberate:
//   - the card work goes through supabaseForUser(), so RLS enforces ownership
//   - the connected_accounts delete stays on supabaseAdmin, because that table
//     holds plaid_access_token and is never exposed to the user-level role.
// See the note at the bottom of docs/migrations/001-rls-write-policies.sql.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase'

export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { card_id } = await request.json()

  const db = supabaseForUser()

  // Get the card first so we know which connected_account it belongs to
  const { data: card } = await db
    .from('cards')
    .select('connected_account_id')
    .eq('id', card_id)
    .eq('user_id', userId)
    .single()

  if (!card) {
    return Response.json({ error: 'Card not found' }, { status: 404 })
  }

  // Delete the card
  await db
    .from('cards')
    .delete()
    .eq('id', card_id)
    .eq('user_id', userId)

  // Manual cards have no bank connection to clean up
  if (card.connected_account_id) {
    // No .eq('user_id') here on purpose: under RLS this count already sees only
    // the caller's own rows. On the service-role client it counted every user's
    // cards, so in principle another user's row could have kept the connection
    // alive forever.
    const { count } = await db
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('connected_account_id', card.connected_account_id)

    if (count === 0) {
      // Service role: connected_accounts is not reachable by the user-level
      // role, so the .eq('user_id') below is load-bearing, not belt and braces.
      await supabaseAdmin
        .from('connected_accounts')
        .delete()
        .eq('id', card.connected_account_id)
        .eq('user_id', userId)
    }
  }

  return Response.json({ success: true })
}
