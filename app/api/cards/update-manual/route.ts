import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { card_id, balance_current, balance_limit, due_date, minimum_payment } =
    await request.json()

  if (!card_id) return Response.json({ error: 'card_id required' }, { status: 400 })

  const { data: card } = await supabaseAdmin
    .from('cards')
    .select('id, source, balance_limit')
    .eq('id', card_id)
    .eq('user_id', userId)
    .single()

  if (!card || card.source !== 'manual') {
    return Response.json({ error: 'Card not found or not editable' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  const newLimit = balance_limit != null ? Number(balance_limit) : card.balance_limit
  if (balance_current != null) {
    updates.balance_current = Number(balance_current)
    updates.balance_available = newLimit - Number(balance_current)
  }
  if (balance_limit != null) updates.balance_limit = newLimit
  if (due_date !== undefined) updates.due_date = due_date || null
  if (minimum_payment !== undefined) {
    updates.minimum_payment = minimum_payment ? Number(minimum_payment) : null
  }

  const { error } = await supabaseAdmin
    .from('cards')
    .update(updates)
    .eq('id', card_id)
    .eq('user_id', userId)

  if (error) {
    console.error('update-manual error:', error)
    return Response.json({ error: 'Failed to update card' }, { status: 500 })
  }

  return Response.json({ success: true })
}
