// app/api/cards/remove/route.ts
//
// Deletes a card from Supabase. If it was the last card from that bank
// connection, also deletes the connected_accounts row.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { card_id } = await request.json()

  // Get the card first so we know which connected_account it belongs to
  const { data: card } = await supabaseAdmin
    .from('cards')
    .select('connected_account_id')
    .eq('id', card_id)
    .eq('user_id', userId)
    .single()

  if (!card) {
    return Response.json({ error: 'Card not found' }, { status: 404 })
  }

  // Delete the card
  await supabaseAdmin
    .from('cards')
    .delete()
    .eq('id', card_id)
    .eq('user_id', userId)

  // Manual cards have no bank connection to clean up
  if (card.connected_account_id) {
    const { count } = await supabaseAdmin
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('connected_account_id', card.connected_account_id)

    if (count === 0) {
      await supabaseAdmin
        .from('connected_accounts')
        .delete()
        .eq('id', card.connected_account_id)
        .eq('user_id', userId)
    }
  }

  return Response.json({ success: true })
}
