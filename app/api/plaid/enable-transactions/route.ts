// app/api/plaid/enable-transactions/route.ts
//
// Called after the user finishes Plaid's update-mode consent screen.
//
// Marking consent is separate from the first sync succeeding: right after
// consent, Plaid is often still pulling the initial transaction history and
// returns PRODUCT_NOT_READY. That's a "check back shortly," not a failure —
// so we record the consent regardless and let the sync catch up.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionId } = await request.json()
  if (!connectionId) {
    return Response.json({ error: 'Missing connectionId' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('connected_accounts')
    .update({ transactions_enabled: true })
    .eq('id', connectionId)
    .eq('user_id', userId)
    // Distinguishes "saved" from "matched nothing" — without it a connection id
    // belonging to another user would report success.
    .select('id')

  if (error) {
    console.error('Failed to mark transactions enabled:', error.message)
    return Response.json({ error: 'Failed to save consent' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return Response.json({ error: 'Connection not found' }, { status: 404 })
  }

  return Response.json({ success: true })
}
