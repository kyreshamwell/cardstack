// app/api/viewed/route.ts
//
// Records that the user has looked at the dashboard, which is what "new since
// last visit" measures against.
//
// The debounce matters: without it, hitting refresh would immediately clear the
// "new" markers you just came to look at. Rapid re-renders (router.refresh()
// after a sync, a quick tab switch) leave the mark where it was.

import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// Views closer together than this are treated as the same sitting.
const DEBOUNCE_MINUTES = 15

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabaseAdmin
    .from('user_state')
    .select('last_viewed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.last_viewed_at) {
    const elapsedMin =
      (Date.now() - new Date(existing.last_viewed_at).getTime()) / 60000
    if (elapsedMin < DEBOUNCE_MINUTES) {
      return Response.json({ updated: false })
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('user_state')
    .upsert({ user_id: userId, last_viewed_at: now, updated_at: now })

  if (error) {
    console.error('Failed to record view:', error.message)
    return Response.json({ error: 'Failed to record view' }, { status: 500 })
  }

  return Response.json({ updated: true })
}
