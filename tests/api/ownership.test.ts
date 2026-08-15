// tests/api/ownership.test.ts
//
// Every one of these routes takes an id straight from the request body. That is
// the classic multi-tenant hole: user B posts user A's card id and mutates or
// deletes it. Each route is checked for three things — it refuses anonymous
// callers, it scopes every write to the caller, and an id the caller doesn't
// own changes nothing and is reported as such rather than as success.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type RecordedCall } from '../helpers/supabase-fake'

const mocks = vi.hoisted(() => ({
  userId: 'user_aaa' as string | null,
  supabase: null as ReturnType<typeof import('../helpers/supabase-fake').createFakeSupabase> | null,
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => Promise.resolve({ userId: mocks.userId }),
}))

// Both clients resolve to the same recorder. The routes now split their work
// between them — user data through supabaseForUser(), and connected_accounts
// (which holds plaid_access_token) still through supabaseAdmin — but the
// assertions below care about the queries issued, not which client issued them.
vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabase!.client
  },
  supabaseForUser: () => mocks.supabase!.client,
}))

const updateLimit = (await import('@/app/api/cards/update-limit/route')).POST
const removeCard = (await import('@/app/api/cards/remove/route')).DELETE
const updateManual = (await import('@/app/api/cards/update-manual/route')).PATCH
const enableTransactions = (await import('@/app/api/plaid/enable-transactions/route')).POST
const importCsv = (await import('@/app/api/transactions/import/route')).POST

const req = (body: unknown) =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** Rows a select returns — [] means "no row the caller owns". */
function setup(reads: Record<string, Record<string, unknown>[]> = {}) {
  mocks.supabase = createFakeSupabase({ reads })
}

const mutations = (calls: RecordedCall[]) =>
  calls.filter((c) => c.op !== 'select')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId = 'user_aaa'
})

// ── Anonymous callers ───────────────────────────────────────────────────────
describe('every mutating route rejects anonymous callers', () => {
  const cases: [string, () => Promise<Response>][] = [
    ['update-limit', () => updateLimit(req({ card_id: 'c1', limit: 5000 }))],
    ['remove', () => removeCard(req({ card_id: 'c1' }))],
    ['update-manual', () => updateManual(req({ card_id: 'c1', name: 'X' }))],
    ['enable-transactions', () => enableTransactions(req({ connectionId: 'conn_1' }))],
    [
      'transactions/import',
      () =>
        importCsv(
          req({ cardId: 'c1', rows: [{ date: '2026-08-09', description: 'X', amount: 1 }] })
        ),
    ],
  ]

  for (const [name, call] of cases) {
    it(`${name} returns 401 and writes nothing`, async () => {
      mocks.userId = null
      setup()

      const res = await call()

      expect(res.status).toBe(401)
      expect(mocks.supabase!.calls).toHaveLength(0)
    })
  }
})

// ── Cross-tenant ids ────────────────────────────────────────────────────────
describe("an id the caller does not own", () => {
  it('update-limit reports 404 rather than a false success', async () => {
    // Previously this returned { success: true } after matching zero rows.
    setup({ cards: [] })

    const res = await updateLimit(req({ card_id: 'someone_elses', limit: 5000 }))

    expect(res.status).toBe(404)
  })

  it('enable-transactions reports 404 rather than a false success', async () => {
    setup({ connected_accounts: [] })

    const res = await enableTransactions(req({ connectionId: 'someone_elses' }))

    expect(res.status).toBe(404)
  })

  it('remove refuses to delete and touches nothing', async () => {
    setup({ cards: [] })

    const res = await removeCard(req({ card_id: 'someone_elses' }))

    expect(res.status).toBe(404)
    expect(mutations(mocks.supabase!.calls)).toHaveLength(0)
  })

  it('update-manual refuses to edit', async () => {
    setup({ cards: [] })

    const res = await updateManual(req({ card_id: 'someone_elses', name: 'Renamed' }))

    expect(res.status).toBe(404)
    expect(mutations(mocks.supabase!.calls)).toHaveLength(0)
  })

  it('transactions/import refuses to write rows against it', async () => {
    setup({ cards: [] })

    const res = await importCsv(
      req({
        cardId: 'someone_elses',
        rows: [{ date: '2026-08-09', description: 'Coffee', amount: 5 }],
      })
    )

    expect(res.status).toBe(404)
    expect(mutations(mocks.supabase!.calls)).toHaveLength(0)
  })
})

// ── Scoping on the happy path ───────────────────────────────────────────────
describe('every write is scoped to the caller', () => {
  it('update-limit scopes by user_id', async () => {
    setup({ cards: [{ id: 'c1' }] })

    await updateLimit(req({ card_id: 'c1', limit: 5000 }))

    for (const call of mutations(mocks.supabase!.calls)) {
      expect(call.filters.user_id).toBe('user_aaa')
    }
  })

  it('remove scopes both the card delete and the connection cleanup', async () => {
    setup({ cards: [{ id: 'c1', connected_account_id: 'conn_1' }] })

    await removeCard(req({ card_id: 'c1' }))

    const writes = mutations(mocks.supabase!.calls)
    expect(writes.length).toBeGreaterThan(0)
    for (const call of writes) {
      expect(call.filters.user_id, `${call.op} on ${call.table} unscoped`).toBe('user_aaa')
    }
  })

  it('update-manual scopes the update', async () => {
    setup({ cards: [{ id: 'c1', source: 'manual' }] })

    await updateManual(req({ card_id: 'c1', name: 'Renamed' }))

    for (const call of mutations(mocks.supabase!.calls)) {
      expect(call.filters.user_id).toBe('user_aaa')
    }
  })

  it('imported rows carry the caller as owner', async () => {
    setup({ cards: [{ id: 'c1', plaid_account_id: null }] })

    await importCsv(
      req({
        cardId: 'c1',
        rows: [{ date: '2026-08-09', description: 'Coffee', amount: 5 }],
      })
    )

    const [upsert] = mocks.supabase!.calls.filter((c) => c.op === 'upsert')
    for (const row of upsert.payload as Record<string, unknown>[]) {
      expect(row.user_id).toBe('user_aaa')
      expect(row.card_id).toBe('c1')
    }
  })

  it('uses the session identity even when a body supplies a different one', async () => {
    // A user_id in the payload must never be trusted over the session.
    setup({ cards: [{ id: 'c1' }] })

    await updateLimit(req({ card_id: 'c1', limit: 5000, user_id: 'user_bbb' }))

    for (const call of mutations(mocks.supabase!.calls)) {
      expect(call.filters.user_id).toBe('user_aaa')
    }
  })
})

// ── Input validation ────────────────────────────────────────────────────────
describe('input validation', () => {
  it('update-limit rejects a missing or non-positive limit', async () => {
    setup({ cards: [{ id: 'c1' }] })

    expect((await updateLimit(req({ card_id: 'c1' }))).status).toBe(400)
    expect((await updateLimit(req({ card_id: 'c1', limit: 0 }))).status).toBe(400)
    expect((await updateLimit(req({ card_id: 'c1', limit: -5 }))).status).toBe(400)
  })

  it('update-limit rejects a limit sent as a string', async () => {
    setup({ cards: [{ id: 'c1' }] })

    expect((await updateLimit(req({ card_id: 'c1', limit: '5000' }))).status).toBe(400)
  })

  it('enable-transactions requires a connection id', async () => {
    setup()

    expect((await enableTransactions(req({}))).status).toBe(400)
  })

  it('transactions/import rejects an empty batch', async () => {
    setup({ cards: [{ id: 'c1' }] })

    expect((await importCsv(req({ cardId: 'c1', rows: [] }))).status).toBe(400)
  })

  it('transactions/import drops unreadable rows instead of storing NaN', async () => {
    setup({ cards: [{ id: 'c1', plaid_account_id: null }] })

    const res = await importCsv(
      req({
        cardId: 'c1',
        rows: [
          { date: '2026-08-09', description: 'Good', amount: 5 },
          { date: '2026-08-09', description: 'Bad', amount: Number.NaN },
          { date: '2026-08-09', description: '', amount: 3 },
        ],
      })
    )
    const body = await res.json()

    expect(body.imported).toBe(1)
    expect(body.skipped).toBe(2)
  })
})
