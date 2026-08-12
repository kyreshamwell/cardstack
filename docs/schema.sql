-- schema.sql
-- Run this in Supabase: SQL Editor → New query → paste → Run
--
-- Two tables for Phase 1:
--   connected_accounts  — one row per bank connection (Plaid "Item")
--   cards               — one row per credit card returned by Plaid
--
-- Why separate tables?
--   One bank (e.g. Chase) can have multiple cards.
--   We store the Plaid access token once on the connection, not on every card.

-- ─── Extensions ─────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── connected_accounts ─────────────────────────────────────────────────────────
-- Represents a single Plaid "Item" — one bank login.
-- A user who connects Chase gets one row here, even if they have 3 Chase cards.
create table connected_accounts (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           text        not null,       -- Clerk user ID, e.g. "user_2abc123"
  plaid_access_token text       not null,       -- secret — NEVER expose to the client
  plaid_item_id     text        not null unique, -- Plaid's ID for this connection
  institution_name  text,                       -- e.g. "Chase"
  institution_id    text,                       -- e.g. "ins_3"
  created_at        timestamptz default now()
);

-- ─── cards ───────────────────────────────────────────────────────────────────────
-- One row per credit card account returned by Plaid.
-- Balances are updated each time we sync with Plaid.
create table cards (
  id                   uuid        primary key default uuid_generate_v4(),
  user_id              text        not null,       -- Clerk user ID (needed for RLS)
  connected_account_id uuid        not null references connected_accounts(id) on delete cascade,
  plaid_account_id     text        not null unique, -- Plaid's stable account identifier
  name                 text        not null,        -- e.g. "Chase Sapphire Preferred"
  mask                 text,                        -- last 4 digits, e.g. "4242"
  balance_current      numeric(12,2),               -- what you currently owe
  balance_available    numeric(12,2),               -- remaining available credit
  balance_limit        numeric(12,2),               -- credit limit
  currency             text        default 'USD',
  last_synced_at       timestamptz,
  created_at           timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────────
-- RLS ensures users can only ever read their own rows.
--
-- We're using Clerk (not Supabase Auth), so we use the service role key
-- for all server-side writes — which bypasses RLS. These SELECT policies
-- protect against any future client-side queries and are good practice.
alter table connected_accounts enable row level security;
alter table cards enable row level security;

create policy "Users see their own connected accounts"
  on connected_accounts for select
  using (user_id = auth.jwt() ->> 'sub');

create policy "Users see their own cards"
  on cards for select
  using (user_id = auth.jwt() ->> 'sub');

-- ─── Indexes ─────────────────────────────────────────────────────────────────────
-- These make "fetch all cards for user X" fast.
create index on connected_accounts (user_id);
create index on cards (user_id);
create index on cards (connected_account_id);

-- ─── Manual card support (run these ALTER statements if cards table already exists) ─
-- connected_account_id and plaid_account_id are null for manually added cards
alter table cards alter column connected_account_id drop not null;
alter table cards alter column plaid_account_id    drop not null;

-- source distinguishes Plaid-connected cards from manually entered ones
alter table cards add column if not exists source text not null default 'plaid';

-- institution_name stored directly on manual cards (Plaid cards use connected_accounts join)
alter table cards add column if not exists institution_name text;

-- liabilities columns added by Plaid sync
alter table cards add column if not exists due_date             date;
alter table cards add column if not exists minimum_payment      numeric(12,2);
alter table cards add column if not exists last_payment_amount  numeric(12,2);
alter table cards add column if not exists last_payment_date    date;
alter table cards add column if not exists is_overdue           boolean;

-- statement balance — what you owe to avoid interest.
-- Distinct from balance_current, which also includes charges made AFTER the
-- statement closed (those belong to next month's statement, not this one).
alter table cards add column if not exists statement_balance    numeric(12,2);
alter table cards add column if not exists statement_date       date;

-- ─── Transactions ────────────────────────────────────────────────────────────────
-- Plaid's /transactions/sync is cursor-based: each call returns what changed
-- since the cursor we last stored, so we never re-download the whole history.
alter table connected_accounts add column if not exists transactions_cursor  text;
alter table connected_accounts add column if not exists transactions_enabled boolean default false;

create table if not exists transactions (
  id                   uuid        primary key default uuid_generate_v4(),
  user_id              text        not null,        -- Clerk user ID
  card_id              uuid        references cards(id) on delete cascade,
  plaid_transaction_id text        not null unique,  -- Plaid's stable transaction ID
  plaid_account_id     text        not null,
  name                 text        not null,        -- raw description from the bank
  merchant_name        text,                        -- Plaid's cleaned-up merchant
  -- Plaid sign convention: POSITIVE = money out (a purchase),
  -- NEGATIVE = money in (a payment or refund).
  amount               numeric(12,2) not null,
  transaction_date     date        not null,
  pending              boolean     default false,
  category             text,                        -- personal_finance_category.primary
  currency             text        default 'USD',
  created_at           timestamptz default now()
);

alter table transactions enable row level security;

create policy "Users see their own transactions"
  on transactions for select
  using (user_id = auth.jwt() ->> 'sub');

create index if not exists transactions_user_idx on transactions (user_id);
create index if not exists transactions_card_idx on transactions (card_id);
create index if not exists transactions_date_idx on transactions (transaction_date desc);

-- ─── Recurring charges ───────────────────────────────────────────────────────────
-- Plaid detects recurring streams from transaction history (/transactions/recurring/get).
-- We store the outflow streams — subscriptions and other repeating charges.
-- Amounts arrive nested as { amount, iso_currency_code }, flattened here.
create table if not exists recurring_charges (
  id                  uuid        primary key default uuid_generate_v4(),
  user_id             text        not null,
  card_id             uuid        references cards(id) on delete cascade,
  plaid_stream_id     text        not null unique,
  plaid_account_id    text        not null,
  description         text        not null,
  merchant_name       text,
  frequency           text,                        -- WEEKLY | BIWEEKLY | SEMI_MONTHLY | MONTHLY | ANNUALLY | UNKNOWN
  average_amount      numeric(12,2),
  last_amount         numeric(12,2),
  last_date           date,
  predicted_next_date date,
  is_active           boolean     default true,
  status              text,                        -- MATURE | EARLY_DETECTION | TOMBSTONED | UNKNOWN
  category            text,
  updated_at          timestamptz default now()
);

alter table recurring_charges enable row level security;

create policy "Users see their own recurring charges"
  on recurring_charges for select
  using (user_id = auth.jwt() ->> 'sub');

create index if not exists recurring_user_idx on recurring_charges (user_id);
create index if not exists recurring_card_idx on recurring_charges (card_id);

-- ─── Per-user state ──────────────────────────────────────────────────────────────
-- Drives "what's new since you last looked". Compared against transactions.created_at
-- (when WE first stored a row), not transaction_date — a charge dated last Tuesday
-- that only synced today is still new *to you*.
create table if not exists user_state (
  user_id        text        primary key,
  last_viewed_at timestamptz,
  updated_at     timestamptz default now()
);

alter table user_state enable row level security;

create policy "Users see their own state"
  on user_state for select
  using (user_id = auth.jwt() ->> 'sub');

-- CSV-imported rows live in the same table as Plaid ones; source tells them apart.
alter table transactions add column if not exists source text not null default 'plaid';

-- Marks a credit limit the user typed in themselves. Plaid returns null for the
-- limit on plenty of cards, and a sync that wrote that null straight through
-- erased whatever the user had entered — every 30 minutes, once auto-refresh
-- existed. When this is true, sync leaves balance_limit alone.
alter table cards add column if not exists limit_is_manual boolean not null default false;
