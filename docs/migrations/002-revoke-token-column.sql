-- 002-revoke-token-column.sql
-- Run this in Supabase: SQL Editor → New query → paste → Run
--
-- ── What this closes ───────────────────────────────────────────────────────
--
-- `plaid_access_token` was readable from the browser by any signed-in user.
--
-- Not through a bug in the app — through the SELECT policy in schema.sql:
--
--   create policy "Users see their own connected accounts"
--     on connected_accounts for select
--     using (user_id = auth.jwt() ->> 'sub');
--
-- RLS policies decide which ROWS an operation may touch. They say nothing about
-- COLUMNS. So that policy hands the `authenticated` role every column of the
-- caller's own row, the bearer token included. The anon key ships in the JS
-- bundle by design, so a signed-in user with devtools open needed only:
--
--   supabase.from('connected_accounts').select('plaid_access_token')
--
-- ── Why 001 concluded this was unfixable, and where that went wrong ────────
--
-- The note at the bottom of 001-rls-write-policies.sql argues that the token
-- cannot be hidden from the browser without also hiding it from the server
-- route that needs it, because both authenticate as `authenticated` and
-- Postgres cannot tell them apart.
--
-- The first half is right and worth keeping: for POLICIES, there is genuinely
-- no expression that separates supabaseForUser() from a browser. Same role,
-- same JWT, same `auth.jwt() ->> 'sub'`.
--
-- The second half does not follow. supabaseAdmin does not authenticate as
-- `authenticated` — it authenticates as `service_role`, a different Postgres
-- role. Column privileges are granted per role, so they draw exactly the line
-- policies cannot:
--
--   authenticated  → gets back only the non-secret columns, listed below
--   anon           → loses the table entirely
--   service_role   → untouched, still reads everything
--
-- Policies were the wrong tool. Grants are the right one.
--
-- ── Why this is REVOKE-then-GRANT and not a column REVOKE ──────────────────
--
-- The obvious spelling does nothing at all:
--
--   revoke select (plaid_access_token) on connected_accounts from authenticated;
--
-- It succeeds, reports no error, and leaves the column readable. From the
-- Postgres REVOKE docs: "if a role has been granted privileges on a table, then
-- revoking the same privileges from individual columns will have no effect."
-- Supabase grants TABLE-level select to anon and authenticated on everything in
-- `public` by default, so that table-level grant just keeps satisfying the read.
--
-- Column privileges are only consulted when there is no table-level privilege
-- to satisfy the query first. So the table-level grant has to go, and the
-- columns that are genuinely public get handed back individually.
--
-- ── What the user-level client actually needs ──────────────────────────────
--
-- Only two queries in the app read this table as the user (everything else is
-- supabaseAdmin, enforced by tests/rls-boundary.test.ts), and between them they
-- need exactly the four columns granted below:
--
--   dashboard/page.tsx  .select('id, institution_name, transactions_enabled')
--   dashboard/page.tsx  .select('*, connected_accounts(institution_name, institution_id)')
--
-- `user_id` is granted too. The RLS policy reads it, and while policy
-- expressions are evaluated by the system rather than under the caller's column
-- privileges, granting it costs nothing — it holds the caller's own Clerk ID,
-- which the browser already knows.
--
-- Deliberately NOT granted: plaid_access_token, plaid_item_id,
-- transactions_cursor. None is read by the user client.
--
-- Note the resulting failure mode, which is the good one: a future `select('*')`
-- on this table from the user client now raises "permission denied for column
-- plaid_access_token" instead of quietly returning the token.

-- ─── The fix ───────────────────────────────────────────────────────────────

-- 1. Drop the blanket table-level read. Until this runs, step 2 is decorative.
revoke select on connected_accounts from authenticated, anon;

-- 2. Hand back only what the dashboard reads. `anon` gets nothing: it has no
--    Clerk identity, so the RLS policy could never match a row for it anyway.
grant select (id, user_id, institution_name, institution_id, transactions_enabled)
  on connected_accounts
  to authenticated;

-- The row-level SELECT policy from schema.sql stays exactly as it is. It still
-- scopes these columns to the caller's own rows; it just no longer carries the
-- token along with them. Rows and columns are now each handled by the mechanism
-- that can actually see them.

-- ─── Verify ────────────────────────────────────────────────────────────────
-- Expect exactly five rows, all for `authenticated`:
--   id, institution_id, institution_name, transactions_enabled, user_id
-- No row for plaid_access_token. No row for anon at all.
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_name = 'connected_accounts'
  and grantee in ('authenticated', 'anon')
  and privilege_type = 'SELECT'
order by grantee, column_name;

-- Confirm the table-level grant is really gone — this should return NO rows for
-- authenticated or anon. If it still lists them, step 1 did not take and the
-- column grants above are being bypassed.
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'connected_accounts'
  and grantee in ('authenticated', 'anon')
  and privilege_type = 'SELECT';

-- And the end-to-end check: signed in, from the browser console. Should fail
-- with "permission denied for column plaid_access_token".
--
--   supabase.from('connected_accounts').select('plaid_access_token')
--
-- While this should still return your connections normally:
--
--   supabase.from('connected_accounts').select('id, institution_name')
