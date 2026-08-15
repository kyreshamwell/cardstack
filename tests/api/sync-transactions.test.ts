import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type RecordedCall } from '../helpers/supabase-fake'

const mocks = vi.hoisted(() => ({
  userId: 'user_aaa' as string | null,
  supabase: null as ReturnType<typeof import('../helpers/supabase-fake').createFakeSupabase> | null,
  transactionsSync: vi.fn(),
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

vi.mock('@/lib/plaid', () => ({
  plaidClient: {
    transactionsSync: (...a: unknown[]) => mocks.transactionsSync(...a),
  },
}))

const { POST } = await import('@/app/api/plaid/sync-transactions/route')

// ── Fixtures ────────────────────────────────────────────────────────────────
const CONNECTION = {
  id: 'conn_1',
  plaid_access_token: 'access-sandbox-xxx',
  institution_name: 'Chase',
  transactions_cursor: 'cursor-abc',
}

function txn(id: string, accountId = 'acct_1') {
  return {
    transaction_id: id,
    account_id: accountId,
    name: 'SHELL OIL',
    merchant_name: 'Shell',
    amount: 52,
    date: '2026-08-09',
    pending: false,
    iso_currency_code: 'USD',
    personal_finance_category: { primary: 'TRANSPORTATION' },
  }
}

function page({
  added = [] as unknown[],
  modified = [] as unknown[],
  removed = [] as { transaction_id: string }[],
  next_cursor = 'cursor-next',
  has_more = false,
} = {}) {
  return { data: { added, modified, removed, next_cursor, has_more } }
}

function setup({
  connection = CONNECTION,
  cards = [{ id: 'card_1', plaid_account_id: 'acct_1' }],
  writeErrors,
}: {
  connection?: Record<string, unknown>
  cards?: Record<string, unknown>[]
  writeErrors?: Record<string, { message: string }>
} = {}) {
  mocks.supabase = createFakeSupabase({
    reads: { connected_accounts: [connection], cards },
    writeErrors,
  })
}

const find = (calls: RecordedCall[], table: string, op: RecordedCall['op']) =>
  calls.filter((c) => c.table === table && c.op === op)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId = 'user_aaa'
  mocks.transactionsSync.mockResolvedValue(page({ added: [txn('t1')] }))
})

// ── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/plaid/sync-transactions — auth', () => {
  it('rejects an unauthenticated request without touching anything', async () => {
    mocks.userId = null
    setup()

    const res = await POST()

    expect(res.status).toBe(401)
    expect(mocks.supabase!.calls).toHaveLength(0)
    expect(mocks.transactionsSync).not.toHaveBeenCalled()
  })
})

describe('POST /api/plaid/sync-transactions — tenant isolation', () => {
  it('scopes reads, updates and deletes to the signed-in user', async () => {
    setup()
    mocks.transactionsSync.mockResolvedValue(
      page({ added: [txn('t1')], removed: [{ transaction_id: 'old' }] })
    )

    await POST()

    // The service-role key bypasses RLS, so this filter is the only isolation.
    for (const call of mocks.supabase!.calls) {
      if (call.op === 'upsert' || call.op === 'insert') continue
      expect(call.filters.user_id, `${call.op} on ${call.table} is unscoped`).toBe(
        'user_aaa'
      )
    }
  })

  it('stamps the owner onto every row it inserts', async () => {
    // Upserts carry ownership in the payload rather than a filter.
    setup()

    await POST()

    const [upsert] = find(mocks.supabase!.calls, 'transactions', 'upsert')
    for (const row of upsert.payload as Record<string, unknown>[]) {
      expect(row.user_id).toBe('user_aaa')
    }
  })
})

describe('POST /api/plaid/sync-transactions — cursor', () => {
  it('sends the stored cursor so it fetches only what changed', async () => {
    setup()

    await POST()

    expect(mocks.transactionsSync).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'cursor-abc' })
    )
  })

  it('starts with no cursor on a first sync', async () => {
    setup({ connection: { ...CONNECTION, transactions_cursor: null } })

    await POST()

    expect(mocks.transactionsSync).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: undefined })
    )
  })

  it('follows pagination and stores the final cursor', async () => {
    setup()
    mocks.transactionsSync
      .mockResolvedValueOnce(
        page({ added: [txn('t1')], next_cursor: 'cursor-p2', has_more: true })
      )
      .mockResolvedValueOnce(
        page({ added: [txn('t2')], next_cursor: 'cursor-final', has_more: false })
      )

    await POST()

    expect(mocks.transactionsSync).toHaveBeenCalledTimes(2)
    // Second call must resume from the first page's cursor, not the original.
    expect(mocks.transactionsSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-p2' })
    )

    const [update] = find(mocks.supabase!.calls, 'connected_accounts', 'update')
    expect(update.payload).toMatchObject({ transactions_cursor: 'cursor-final' })

    const [upsert] = find(mocks.supabase!.calls, 'transactions', 'upsert')
    expect(upsert.payload).toHaveLength(2)
  })

  it('does NOT advance the cursor when the write fails', async () => {
    // The data-loss case: advancing past rows that were never stored means
    // Plaid never sends them again and they are gone permanently.
    setup({ writeErrors: { transactions: { message: 'db unavailable' } } })

    const body = await (await POST()).json()

    expect(find(mocks.supabase!.calls, 'connected_accounts', 'update')).toHaveLength(0)
    expect(body.failed).toBe(1)
  })

  it('still advances the cursor when a sync returns nothing new', async () => {
    setup()
    mocks.transactionsSync.mockResolvedValue(page({ next_cursor: 'cursor-quiet' }))

    await POST()

    const [update] = find(mocks.supabase!.calls, 'connected_accounts', 'update')
    expect(update.payload).toMatchObject({ transactions_cursor: 'cursor-quiet' })
  })
})

describe('POST /api/plaid/sync-transactions — writes', () => {
  it('upserts on the Plaid id so re-running does not duplicate', async () => {
    setup()

    await POST()

    const [upsert] = find(mocks.supabase!.calls, 'transactions', 'upsert')
    expect(upsert.options).toMatchObject({ onConflict: 'plaid_transaction_id' })
  })

  it('maps a transaction onto the right card', async () => {
    setup()

    await POST()

    const [upsert] = find(mocks.supabase!.calls, 'transactions', 'upsert')
    expect((upsert.payload as Record<string, unknown>[])[0]).toMatchObject({
      card_id: 'card_1',
      plaid_transaction_id: 't1',
      amount: 52,
      transaction_date: '2026-08-09',
      merchant_name: 'Shell',
      category: 'TRANSPORTATION',
    })
  })

  it('ignores accounts we do not track, like a checking account on the same login', async () => {
    setup()
    mocks.transactionsSync.mockResolvedValue(
      page({ added: [txn('t1', 'acct_1'), txn('t2', 'acct_checking')] })
    )

    await POST()

    const [upsert] = find(mocks.supabase!.calls, 'transactions', 'upsert')
    const ids = (upsert.payload as Record<string, unknown>[]).map(
      (r) => r.plaid_transaction_id
    )
    expect(ids).toEqual(['t1'])
  })

  it('deletes removed transactions so a pending charge is not left beside its posted twin', async () => {
    setup()
    mocks.transactionsSync.mockResolvedValue(
      page({ removed: [{ transaction_id: 'pending_1' }] })
    )

    await POST()

    const [del] = find(mocks.supabase!.calls, 'transactions', 'delete')
    expect(del.filters.plaid_transaction_id).toEqual(['pending_1'])
  })

  it('skips the write entirely when nothing changed', async () => {
    setup()
    mocks.transactionsSync.mockResolvedValue(page())

    await POST()

    expect(find(mocks.supabase!.calls, 'transactions', 'upsert')).toHaveLength(0)
    expect(find(mocks.supabase!.calls, 'transactions', 'delete')).toHaveLength(0)
  })

  it('marks the connection as transaction-enabled once a sync succeeds', async () => {
    setup()

    await POST()

    const [update] = find(mocks.supabase!.calls, 'connected_accounts', 'update')
    expect(update.payload).toMatchObject({ transactions_enabled: true })
  })
})

describe('POST /api/plaid/sync-transactions — failure handling', () => {
  it('flags a consent error so the UI can prompt instead of just erroring', async () => {
    setup()
    mocks.transactionsSync.mockRejectedValue({
      response: { data: { error_code: 'ADDITIONAL_CONSENT_REQUIRED' } },
    })

    const body = await (await POST()).json()

    expect(body.failures[0]).toMatchObject({
      code: 'ADDITIONAL_CONSENT_REQUIRED',
      needsConsent: true,
      pending: false,
    })
  })

  it('flags PRODUCT_NOT_READY as pending, not as a real failure', async () => {
    // Plaid is still building history right after consent — it resolves itself.
    setup()
    mocks.transactionsSync.mockRejectedValue({
      response: { data: { error_code: 'PRODUCT_NOT_READY' } },
    })

    const body = await (await POST()).json()

    expect(body.failures[0]).toMatchObject({ pending: true, needsConsent: false })
  })

  it('reports a per-connection failure without failing the whole request', async () => {
    setup()
    mocks.transactionsSync.mockRejectedValue(new Error('boom'))

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.synced).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.failures[0].institution).toBe('Chase')
  })
})
