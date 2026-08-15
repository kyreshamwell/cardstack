import { auth } from '@clerk/nextjs/server'
import { supabaseForUser } from '@/lib/supabase'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, institution_name, balance_current, balance_limit, due_date, minimum_payment } =
    await request.json()

  if (!name || balance_current == null || balance_limit == null) {
    return Response.json({ error: 'Name, balance, and limit are required' }, { status: 400 })
  }

  const current = Number(balance_current)
  const limit = Number(balance_limit)

  const db = supabaseForUser()

  const { error } = await db.from('cards').insert({
    user_id: userId,
    source: 'manual',
    name,
    institution_name: institution_name?.trim() || null,
    balance_current: current,
    balance_limit: limit,
    balance_available: limit - current,
    due_date: due_date || null,
    minimum_payment: minimum_payment ? Number(minimum_payment) : null,
    connected_account_id: null,
    plaid_account_id: null,
  })

  if (error) {
    console.error('add-manual error:', error)
    return Response.json({ error: 'Failed to add card' }, { status: 500 })
  }

  return Response.json({ success: true })
}
