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
