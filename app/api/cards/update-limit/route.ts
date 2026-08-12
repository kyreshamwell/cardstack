// app/api/cards/update-limit/route.ts
//
// Saves a manually entered credit limit when Plaid doesn't provide one.
// Verifies the card belongs to the authenticated user before updating.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { card_id, limit } = await request.json()

  if (!card_id || typeof limit !== 'number' || limit <= 0) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('cards')
    // limit_is_manual stops the next Plaid sync from overwriting this.
    .update({ balance_limit: limit, limit_is_manual: true })
    .eq('id', card_id)
    .eq('user_id', userId) // ensures users can only update their own cards
    // Returning the affected rows is what makes a no-op distinguishable from a
    // success. Without it, a card id belonging to someone else — or one deleted
    // in another tab — matches zero rows and still reports success.
    .select('id')

  if (error) {
    return Response.json({ error: 'Failed to update limit' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return Response.json({ error: 'Card not found' }, { status: 404 })
  }

  return Response.json({ success: true })
}
