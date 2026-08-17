// lib/plaid.ts — Plaid API client.
//
// PlaidApi is the typed client for every Plaid endpoint.
// Configuration tells it which environment to hit and how to authenticate.
//
// PLAID_ENV controls which base URL is used:
//   sandbox     → fake data, no real banks, free
//   development → real banks, up to 100 items, requires approval
//   production  → real banks, paid
//
// We start in sandbox. Switching environments = change one env var.

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

/**
 * The machine-readable reason a Plaid call failed, for logs.
 *
 * Plaid returns its detail nested inside the axios error rather than on the
 * Error itself, so `err.message` alone reports a bare "Request failed with
 * status code 400" and loses the part that says why.
 *
 * Log this; do not return it to the browser. Plaid's error_message can name the
 * institution and echo request specifics, and the client has nothing to do with
 * either — every route here answers failures with a generic message instead.
 */
export function plaidErrorCode(err: unknown): string {
  return plaidErrorCodeOrNull(err) ?? (err instanceof Error ? err.message : 'UNKNOWN_ERROR')
}

/**
 * Plaid's `error_code` if this really is a Plaid failure, otherwise null.
 *
 * The distinction is what makes a code safe to hand to the browser. Plaid's
 * codes are a short public enum — PRODUCT_NOT_READY, ITEM_LOGIN_REQUIRED — and
 * the dashboard genuinely branches on them to decide whether to show a reauth
 * or consent button.
 *
 * Anything else reaching the same catch block is OURS: a failed upsert carrying
 * a Postgres message, complete with column and constraint names. Those read
 * like error codes once they're in the same field, and they belong in the log
 * only. Callers should send `plaidErrorCodeOrNull(err) ?? 'SYNC_FAILED'` to the
 * client and `plaidErrorCode(err)` to the console.
 */
export function plaidErrorCodeOrNull(err: unknown): string | null {
  return (
    (err as { response?: { data?: { error_code?: string } } })?.response?.data
      ?.error_code ?? null
  )
}
