// app/api/viewed/route.ts
//
// Records that the user has looked at the dashboard, which is what "new since
// last visit" measures against.
//
// The debounce matters: without it, hitting refresh would immediately clear the
// "new" markers you just came to look at. Rapid re-renders (router.refresh()
// after a sync, a quick tab switch) leave the mark where it was.
//
// ── First route migrated off the service-role key ──────────────────────────
//
// This is the pilot for moving every route from `supabaseAdmin` (which bypasses
// Row Level Security) to `supabaseForUser()` (which enforces it). It was chosen
// because it's the smallest read/write pair in the app — if the Clerk↔Supabase
// integration is misconfigured, it fails here rather than somewhere expensive.
//
// The `.eq('user_id', …)` filters below are now BELT AND BRACES, not the
// security boundary. The policies in docs/schema.sql are what restrict these
// rows, and they run in the database where a future query can't forget them.
// See the note in lib/supabase.ts.

import { auth } from '@clerk/nextjs/server'
import { supabaseForUser } from '@/lib/supabase'

// Views closer together than this are treated as the same sitting.
const DEBOUNCE_MINUTES = 15

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseForUser()

  const { data: existing } = await db
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
  const { error } = await db
    .from('user_state')
    .upsert({ user_id: userId, last_viewed_at: now, updated_at: now })

  if (error) {
    // Worth reading carefully while the migration is in progress: an RLS denial
    // surfaces here as an ordinary error, not as an exception. If this starts
    // firing after the switch, the integration is the first thing to check.
    console.error('Failed to record view:', error.message)
    return Response.json({ error: 'Failed to record view' }, { status: 500 })
  }

  return Response.json({ updated: true })
}
