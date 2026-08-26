-- 001-rls-write-policies.sql
-- Run this in Supabase: SQL Editor → New query → paste → Run
--
-- ── Why this exists ────────────────────────────────────────────────────────
--
-- schema.sql enables row level security on five tables and gives each one a
-- SELECT policy. That was enough while every route used the service role key,
-- because Postgres exempts service_role from RLS entirely, so the policies were
-- documentation, not enforcement.
--
-- Moving routes onto supabaseForUser() makes the policies real, and reveals
-- what's missing. In Postgres, RLS enabled + no policy for an operation means
-- that operation is DENIED. With SELECT-only policies, every insert, update
-- and delete in the app would start failing.
--
-- This migration adds the missing operations. It's written to be re-runnable:
-- each policy is dropped before it's created, so running it twice is safe.
--
-- ── The shape of every policy ──────────────────────────────────────────────
--
-- `auth.jwt() ->> 'sub'` is the Clerk user ID from the session token, which is
-- exactly what every table's user_id column already holds.
--
-- USING vs WITH CHECK is the part worth understanding:
--   USING:      which existing rows this operation may TOUCH (select/update/delete)
--   WITH CHECK: what a row is allowed to LOOK LIKE after it's written (insert/update)
--
-- UPDATE needs both. Without WITH CHECK you could take one of your own rows and
-- reassign its user_id to someone else's, passing USING on the way in and
-- writing a row you no longer own on the way out.

-- ─── cards ─────────────────────────────────────────────────────────────────
drop policy if exists "Users insert their own cards" on cards;
create policy "Users insert their own cards"
  on cards for insert
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users update their own cards" on cards;
create policy "Users update their own cards"
  on cards for update
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users delete their own cards" on cards;
create policy "Users delete their own cards"
  on cards for delete
  using (user_id = auth.jwt() ->> 'sub');

-- ─── transactions ──────────────────────────────────────────────────────────
drop policy if exists "Users insert their own transactions" on transactions;
create policy "Users insert their own transactions"
  on transactions for insert
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users update their own transactions" on transactions;
create policy "Users update their own transactions"
  on transactions for update
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users delete their own transactions" on transactions;
create policy "Users delete their own transactions"
  on transactions for delete
  using (user_id = auth.jwt() ->> 'sub');

-- ─── recurring_charges ─────────────────────────────────────────────────────
drop policy if exists "Users insert their own recurring charges" on recurring_charges;
create policy "Users insert their own recurring charges"
  on recurring_charges for insert
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users update their own recurring charges" on recurring_charges;
create policy "Users update their own recurring charges"
  on recurring_charges for update
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users delete their own recurring charges" on recurring_charges;
create policy "Users delete their own recurring charges"
  on recurring_charges for delete
  using (user_id = auth.jwt() ->> 'sub');

-- ─── user_state ────────────────────────────────────────────────────────────
-- The upsert in app/api/viewed/route.ts needs BOTH of these: an upsert is an
-- insert that may become an update, and Postgres checks the policy for whichever
-- path it actually takes. An insert policy alone fails on the second visit.
drop policy if exists "Users insert their own state" on user_state;
create policy "Users insert their own state"
  on user_state for insert
  with check (user_id = auth.jwt() ->> 'sub');

drop policy if exists "Users update their own state" on user_state;
create policy "Users update their own state"
  on user_state for update
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

-- ─── connected_accounts: deliberately NOT given write policies ─────────────
--
-- This table stores plaid_access_token, which is a bearer credential for the
-- user's bank data. It stays on the service-role client, and the reasoning is
-- worth keeping because it looks like an inconsistency otherwise:
--
-- supabaseForUser() authenticates as the `authenticated` role. So does a
-- Supabase client running in a browser with a Clerk token. Postgres cannot
-- tell those two apart, because they are the same role, so any policy permissive
-- enough for the server route is equally permissive for the browser.
--
-- There is no POLICY that separates them. So the separation stays at the key
-- level: only code holding the service-role key touches this table.
--
-- The existing SELECT policy is left in place. It's what lets the dashboard's
-- `cards → connected_accounts(institution_name, …)` join resolve for the user
-- client, and that join never selects the token column.
--
-- ⚠ CORRECTED BY 002-revoke-token-column.sql. Read this part with care.
--
-- This file originally continued: "...and column-level REVOKE that hides the
-- token from the browser would also hide it from the server route that
-- legitimately needs it." That was wrong, and it left the token readable from
-- the browser for as long as it stood.
--
-- supabaseAdmin authenticates as `service_role`, NOT `authenticated`. Column
-- privileges are per-role, so they draw precisely the line policies cannot: the
-- browser and supabaseForUser() lose the column, supabaseAdmin keeps it. (The
-- spelling matters: a bare column REVOKE is silently a no-op against Supabase's
-- default table-level grant. 002 explains why it is revoke-then-grant-back.)
--
-- The lesson generalizes past this table: "the app never selects that column"
-- is a statement about the app's queries, not about what the caller is allowed
-- to ask for. RLS scopes rows; only grants scope columns. See 002.

-- ─── Verify ────────────────────────────────────────────────────────────────
-- Should list 16 policies: 3 writes × 3 tables, 2 writes on user_state,
-- plus the 5 original SELECT policies.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
