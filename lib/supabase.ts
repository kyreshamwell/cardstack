// lib/supabase.ts: three Supabase clients with different permission levels.
//
//   supabase (anon key)
//     - safe in browser/client components
//     - respects Row Level Security, but carries no identity, so on its own it
//       can see nothing belonging to any user
//
//   supabaseForUser() (anon key + the signed-in user's Clerk token)  ← prefer this
//     - server-side, and RLS is ENFORCED
//     - the database restricts rows to the caller, so isolation no longer
//       depends on each query remembering to filter
//
//   supabaseAdmin (service role key)
//     - bypasses RLS entirely: full read/write across every user's rows
//     - server-side only, NEVER in a client component
//     - think of it as a database superuser
//
// ── Which client to reach for ──────────────────────────────────────────────
//
// Default to supabaseForUser(). Everything used to run on supabaseAdmin, which
// meant the RLS policies never ran and the only thing keeping one user's cards
// away from another was that every query remembered `.eq('user_id', …)`.
// Correct at the time, one forgotten filter away from returning everyone's rows.
//
// supabaseForUser() moves that guarantee into the database, so a query that
// forgets its filter returns too few rows instead of too many.
//
// supabaseAdmin now has exactly ONE legitimate use: the connected_accounts
// table, which stores plaid_access_token. That column is a bearer credential
// for the user's bank data and must never be readable by the user-level
// Postgres role, and there is no policy that would allow the server route to
// read it while denying a browser, because both authenticate as the same
// `authenticated` role. So the separation lives at the key level instead.
//
// Two layers hold that separation, and it's worth knowing they are different
// mechanisms doing different jobs:
//
//   1. The key. Only supabaseAdmin (service_role) queries this table, enforced
//      at review time by tests/rls-boundary.test.ts.
//   2. The grant. docs/migrations/002-revoke-token-column.sql drops the
//      table-level SELECT for `authenticated`/`anon` and grants back only the
//      non-secret columns, so even a query that ignores rule 1 (or a browser
//      using the public anon key with a valid Clerk token) is refused by
//      Postgres rather than merely by convention.
//
// Layer 2 exists because layer 1 is a convention about code, and the token was
// in fact readable from any signed-in browser until 002 ran. RLS policies scope
// ROWS; only column grants scope COLUMNS.
//
// tests/rls-boundary.test.ts enforces that rule by sweeping the source: any
// supabaseAdmin query against a table other than connected_accounts fails the
// build. If you have a genuine new case, such as a cron job with no user
// session, extend that test deliberately rather than working around it.

import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Anon client: client-safe, RLS-enforced, no identity attached.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client: server-side only, RLS bypassed.
// Only for connected_accounts; see the note above and tests/rls-boundary.test.ts.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * A Supabase client that acts AS the signed-in user, with RLS enforced.
 *
 * Uses the anon key deliberately. The anon key carries no special privileges,
 * so Postgres evaluates the policies in `docs/schema.sql`, which match on
 * `auth.jwt() ->> 'sub'` against the Clerk user ID already stored in every
 * table's `user_id` column.
 *
 * `accessToken` is Supabase's hook for third-party auth: it runs per request
 * and hands over Clerk's session token. `getToken()` takes NO template
 * argument. The JWT-template approach was deprecated in April 2025 and
 * replaced by a native integration where Supabase is configured to trust
 * Clerk's domain directly, so no Supabase JWT secret is ever shared with Clerk.
 *
 * Requires that integration to be active on BOTH dashboards. Without it the
 * token isn't trusted, the request is treated as anonymous, and queries return
 * nothing. It fails closed, not open.
 */
export function supabaseForUser() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    async accessToken() {
      return (await auth()).getToken()
    },
  })
}
