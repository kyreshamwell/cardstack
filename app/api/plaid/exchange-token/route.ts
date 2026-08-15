// app/api/plaid/exchange-token/route.ts
//
// Called immediately after Plaid Link closes successfully.
// Receives the public_token from the browser and does three things:
//
//   1. Swaps it for a permanent access_token (the real credential)
//   2. Saves the access_token + institution info to connected_accounts
//   3. Fetches the user's accounts from Plaid and saves credit cards to the cards table
//
// Why can't the browser do this directly?
//   The access_token must NEVER touch the client. This route is the only place
//   it exists — Supabase stores it, and it only ever gets read server-side.
//
// That is also why this route uses two Supabase clients: the connected_accounts
// insert below carries the access_token and stays on supabaseAdmin, while the
// cards writes go through supabaseForUser() so RLS enforces ownership.
// See docs/migrations/001-rls-write-policies.sql.

import { auth } from '@clerk/nextjs/server'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin, supabaseForUser } from '@/lib/supabase'
import { CountryCode } from 'plaid'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseForUser()

  const { public_token } = await request.json()

  // ── Step 1: Swap public_token for access_token ──────────────────────────────
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token })
  const { access_token, item_id } = exchangeResponse.data

  // ── Step 2: Get institution name ─────────────────────────────────────────────
  const itemResponse = await plaidClient.itemGet({ access_token })
  const institutionId = itemResponse.data.item.institution_id ?? ''

  let institutionName = 'Unknown'
  if (institutionId) {
    const instResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    })
    institutionName = instResponse.data.institution.name
  }

  // ── Step 3: Save connection to Supabase ───────────────────────────────────────
  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('connected_accounts')
    .insert({
      user_id: userId,
      plaid_access_token: access_token,
      plaid_item_id: item_id,
      institution_name: institutionName,
      institution_id: institutionId,
    })
    .select()
    .single()

  if (connectionError) {
    console.error('Error saving connection:', connectionError)
    return Response.json({ error: 'Failed to save connection' }, { status: 500 })
  }

  // ── Step 4: Fetch accounts from Plaid ────────────────────────────────────────
  const accountsResponse = await plaidClient.accountsGet({ access_token })
  const accounts = accountsResponse.data.accounts

  // In production/development, filter to credit cards only.
  // In sandbox, Plaid test institutions only return depository accounts so we
  // skip the filter — otherwise nothing ever saves during local development.
  const isSandbox = process.env.PLAID_ENV === 'sandbox'
  const creditCards = isSandbox
    ? accounts
    : accounts.filter(
        (account) => account.type === 'credit' || account.subtype === 'credit card'
      )

  // ── Step 5: Save each card to Supabase ────────────────────────────────────────
  if (creditCards.length > 0) {
    const cardRows = creditCards.map((account) => ({
      user_id: userId,
      connected_account_id: connection.id,
      plaid_account_id: account.account_id,
      name: account.name,
      mask: account.mask,
      balance_current: account.balances.current,
      balance_available: account.balances.available,
      balance_limit: account.balances.limit,
      currency: account.balances.iso_currency_code ?? 'USD',
      last_synced_at: new Date().toISOString(),
    }))

    const { error: cardsError } = await db.from('cards').insert(cardRows)
    if (cardsError) {
      console.error('Error saving cards:', cardsError)
      return Response.json({ error: 'Failed to save cards' }, { status: 500 })
    }
  }

  // ── Step 6: Fetch liabilities (due dates, minimum payments) ─────────────────
  // liabilitiesGet only works if the institution supports it.
  // We wrap in try/catch so a missing Liabilities product doesn't break the whole flow.
  try {
    const liabilitiesResponse = await plaidClient.liabilitiesGet({ access_token })
    const creditLiabilities = liabilitiesResponse.data.liabilities.credit ?? []

    for (const liability of creditLiabilities) {
      await db
        .from('cards')
        .update({
          due_date: liability.next_payment_due_date ?? null,
          minimum_payment: liability.minimum_payment_amount ?? null,
          last_payment_amount: liability.last_payment_amount ?? null,
          last_payment_date: liability.last_payment_date ?? null,
          is_overdue: liability.is_overdue ?? false,
        })
        .eq('plaid_account_id', liability.account_id)
        .eq('user_id', userId)
    }
  } catch {
    // Institution doesn't support Liabilities — due dates will just be null
    console.log('Liabilities not available for this institution')
  }

  return Response.json({
    success: true,
    institution: institutionName,
    cards_connected: creditCards.length,
  })
}
