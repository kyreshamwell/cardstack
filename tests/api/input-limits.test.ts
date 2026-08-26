// tests/api/input-limits.test.ts
//
// What an authenticated caller is allowed to SEND, as distinct from what they
// are allowed to reach. tests/api/ownership.test.ts covers the second; these
// cover the first, and the difference matters because every route here already
// passed the ownership checks.
//
// Two habits are pinned down:
//
//   1. A request body is input, not a promise. Route handlers get a raw JSON
//      body with no size limit and no schema. An array field decides how much
//      of the database one POST writes unless the route says otherwise.
//   2. Upstream error text stays server-side. Plaid's error_message names the
//      institution and echoes request specifics; the browser gets a sentence it
//      can act on instead.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase } from '../helpers/supabase-fake'

const mocks = vi.hoisted(() => ({
  userId: 'user_aaa' as string | null,
  supabase: null as ReturnType<typeof import('../helpers/supabase-fake').createFakeSupabase> | null,
  itemPublicTokenExchange: vi.fn(),
  itemGet: vi.fn(),
  institutionsGetById: vi.fn(),
  accountsGet: vi.fn(),
  liabilitiesGet: vi.fn(),
  linkTokenCreate: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => Promise.resolve({ userId: mocks.userId }),
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabase!.client
  },
  supabaseForUser: () => mocks.supabase!.client,
}))

// Real error helpers, faked network client: same split as the sync tests.
vi.mock('@/lib/plaid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/plaid')>()),
  plaidClient: {
    itemPublicTokenExchange: (...a: unknown[]) => mocks.itemPublicTokenExchange(...a),
    itemGet: (...a: unknown[]) => mocks.itemGet(...a),
    institutionsGetById: (...a: unknown[]) => mocks.institutionsGetById(...a),
    accountsGet: (...a: unknown[]) => mocks.accountsGet(...a),
    liabilitiesGet: (...a: unknown[]) => mocks.liabilitiesGet(...a),
    linkTokenCreate: (...a: unknown[]) => mocks.linkTokenCreate(...a),
  },
}))

const importCsv = (await import('@/app/api/transactions/import/route')).POST
const exchangeToken = (await import('@/app/api/plaid/exchange-token/route')).POST
const createLinkToken = (await import('@/app/api/plaid/create-link-token/route')).POST

const req = (body: unknown) =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** A body that is not JSON at all, i.e. what a truncated upload looks like. */
const brokenReq = () =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"cardId":"c1","rows":[',
  })

const csvRow = (i: number) => ({
  date: '2026-08-09',
  description: `Charge ${i}`,
  amount: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId = 'user_aaa'
  mocks.supabase = createFakeSupabase({ reads: { cards: [{ id: 'c1', plaid_account_id: null }] } })
})

// ── CSV import: how much one request may write ──────────────────────────────
describe('POST /api/transactions/import: request size', () => {
  it('refuses a row count past the cap and writes nothing', async () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => csvRow(i))

    const res = await importCsv(req({ cardId: 'c1', rows }))

    expect(res.status).toBe(413)
    expect(mocks.supabase!.writes()).toHaveLength(0)
  })

  it('rejects rather than silently importing part of an oversized file', async () => {
    // A truncating cap would return success having stored a prefix, and the
    // missing rows would surface much later as a balance that won't reconcile.
    const rows = Array.from({ length: 10_001 }, (_, i) => csvRow(i))

    const body = await (await importCsv(req({ cardId: 'c1', rows }))).json()

    expect(body).not.toHaveProperty('imported')
    expect(body.error).toMatch(/limit is/i)
  })

  it('accepts a file exactly at the cap', async () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => csvRow(i))

    const res = await importCsv(req({ cardId: 'c1', rows }))

    expect(res.status).toBe(200)
    expect(mocks.supabase!.writes()).toHaveLength(1)
  })

  it('caps a single description instead of storing it whole', async () => {
    const rows = [{ date: '2026-08-09', description: 'X'.repeat(5000), amount: 1 }]

    await importCsv(req({ cardId: 'c1', rows }))

    const [write] = mocks.supabase!.writes()
    const stored = (write.payload as { name: string }[])[0]
    expect(stored.name).toHaveLength(500)
  })

  it('answers a malformed body with 400 rather than an unhandled throw', async () => {
    const res = await importCsv(brokenReq())

    expect(res.status).toBe(400)
    expect(mocks.supabase!.writes()).toHaveLength(0)
  })

  it('rejects a cardId that is not a string', async () => {
    // `.eq()` parameterizes, so this was never injection, but an object here
    // matched nothing and still reported a successful import of zero rows.
    const res = await importCsv(req({ cardId: { $ne: null }, rows: [csvRow(1)] }))

    expect(res.status).toBe(400)
    expect(mocks.supabase!.writes()).toHaveLength(0)
  })
})

// ── exchange-token: the one route that used to throw ────────────────────────
describe('POST /api/plaid/exchange-token: input validation', () => {
  it('rejects a missing public_token without calling Plaid', async () => {
    const res = await exchangeToken(req({}))

    expect(res.status).toBe(400)
    expect(mocks.itemPublicTokenExchange).not.toHaveBeenCalled()
    expect(mocks.supabase!.writes()).toHaveLength(0)
  })

  it('rejects a non-string public_token', async () => {
    const res = await exchangeToken(req({ public_token: { toString: 'nope' } }))

    expect(res.status).toBe(400)
    expect(mocks.itemPublicTokenExchange).not.toHaveBeenCalled()
  })

  it('answers a rejected token with an error instead of an unhandled throw', async () => {
    // Link tokens expire after ~30 minutes, and onSuccess can fire twice. Both
    // produce a token Plaid refuses. This used to reject unhandled.
    mocks.itemPublicTokenExchange.mockRejectedValue({
      response: { data: { error_code: 'INVALID_PUBLIC_TOKEN', error_message: 'already exchanged' } },
    })

    const res = await exchangeToken(req({ public_token: 'public-sandbox-expired' }))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(mocks.supabase!.writes()).toHaveLength(0)
    expect(JSON.stringify(body)).not.toContain('already exchanged')
  })

  it('keeps the connection when reading accounts fails afterwards', async () => {
    // The access_token is the only handle on the Plaid Item. Discarding it
    // because a later call failed would orphan the Item with no way back.
    mocks.itemPublicTokenExchange.mockResolvedValue({
      data: { access_token: 'access-xxx', item_id: 'item_1' },
    })
    mocks.itemGet.mockResolvedValue({ data: { item: { institution_id: 'ins_3' } } })
    mocks.institutionsGetById.mockResolvedValue({ data: { institution: { name: 'Chase' } } })
    mocks.accountsGet.mockRejectedValue({ response: { data: { error_code: 'PRODUCT_NOT_READY' } } })
    mocks.supabase = createFakeSupabase({ reads: { connected_accounts: [{ id: 'conn_1' }] } })

    const body = await (await exchangeToken(req({ public_token: 'public-ok' }))).json()

    expect(body.success).toBe(true)
    expect(body.cards_connected).toBe(0)
    expect(mocks.supabase!.forTable('connected_accounts')).not.toHaveLength(0)
  })
})

// ── create-link-token: upstream error text ──────────────────────────────────
describe('POST /api/plaid/create-link-token: error handling', () => {
  it('does not forward Plaid error text to the client', async () => {
    mocks.linkTokenCreate.mockRejectedValue({
      response: {
        data: {
          error_code: 'INVALID_FIELD',
          error_message: 'client_id must be 24 characters',
        },
      },
    })

    const res = await createLinkToken(req({}))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(JSON.stringify(body)).not.toContain('24 characters')
    expect(JSON.stringify(body)).not.toContain('INVALID_FIELD')
    expect(body.error).toMatch(/try again/i)
  })
})
