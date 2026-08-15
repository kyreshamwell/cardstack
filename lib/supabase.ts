// lib/supabase.ts — three Supabase clients with different permission levels.
//
//   supabase (anon key)
//     — safe in browser/client components
//     — respects Row Level Security, but carries no identity, so on its own it
//       can see nothing belonging to any user
//
//   supabaseForUser() (anon key + the signed-in user's Clerk token)  ← prefer this
//     — server-side, and RLS is ENFORCED
//     — the database restricts rows to the caller, so isolation no longer
//       depends on each query remembering to filter
//
//   supabaseAdmin (service role key)
//     — bypasses RLS entirely: full read/write across every user's rows
//     — server-side only, NEVER in a client component
//     — think of it as a database superuser
//
// ── Why this file is mid-migration ─────────────────────────────────────────
//
// Everything used supabaseAdmin. That works, but it means the RLS policies in
// docs/schema.sql never run, and the only thing keeping one user's cards away
// from another is that all 25 queries remember `.eq('user_id', …)`. Correct
// today; one forgotten filter away from returning everyone's rows tomorrow.
//
// supabaseForUser() moves that guarantee into the database. Use it for anything
// acting on behalf of a signed-in user. Reserve supabaseAdmin for work with no
// user session at all — a cron sync, say — and say why at the call site.

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Anon client — client-safe, RLS-enforced, no identity attached.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — server-side only, RLS bypassed.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * A Supabase client that acts AS the signed-in user, with RLS enforced.
 *
 * Uses the anon key deliberately. The anon key carries no special privileges,
 * so Postgres evaluates the policies in `docs/schema.sql` — which match on
 * `auth.jwt() ->> 'sub'` against the Clerk user ID already stored in every
 * table's `user_id` column.
 *
 * `accessToken` is Supabase's hook for third-party auth: it runs per request
 * and hands over Clerk's session token. `getToken()` takes NO template
 * argument — the JWT-template approach was deprecated in April 2025 and
 * replaced by a native integration where Supabase is configured to trust
 * Clerk's domain directly, so no Supabase JWT secret is ever shared with Clerk.
 *
 * Requires that integration to be active on BOTH dashboards. Without it the
 * token isn't trusted, the request is treated as anonymous, and queries return
 * nothing — it fails closed, not open.
 */
export function supabaseForUser() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    async accessToken() {
      return (await auth()).getToken()
    },
  })
}
