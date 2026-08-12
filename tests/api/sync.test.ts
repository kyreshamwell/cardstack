import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type RecordedCall } from '../helpers/supabase-fake'

// ── Module mocks ────────────────────────────────────────────────────────────
// Hoisted so the route sees these instead of the real Clerk/Plaid/Supabase.
const mocks = vi.hoisted(() => ({
  userId: 'user_aaa' as string | null,
  supabase: null as ReturnType<typeof import('../helpers/supabase-fake').createFakeSupabase> | null,
  accountsBalanceGet: vi.fn(),
  liabilitiesGet: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => Promise.resolve({ userId: mocks.userId }),
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabase!.client
  },
}))

vi.mock('@/lib/plaid', () => ({
  plaidClient: {
    accountsBalanceGet: (...a: unknown[]) => mocks.accountsBalanceGet(...a),
    liabilitiesGet: (...a: unknown[]) => mocks.liabilitiesGet(...a),
  },
}))

const { POST } = await import('@/app/api/plaid/sync/route')

// ── Fixtures ────────────────────────────────────────────────────────────────
const CONNECTION = {
  id: 'conn_1',
  plaid_access_token: 'access-sandbox-xxx',
  institution_name: 'Chase',
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    account_id: 'acct_1',
    balances: { current: 1000, available: 4000, limit: 5000, ...(overrides.balances ?? {}) },
    ...overrides,
  }
}

function setup({
  cards = [{ plaid_account_id: 'acct_1', limit_is_manual: false }],
  accounts = [account()],
}: {
  cards?: Record<string, unknown>[]
  accounts?: Record<string, unknown>[]
} = {}) {
  mocks.supabase = createFakeSupabase({
    reads: { connected_accounts: [CONNECTION], cards },
  })
  mocks.accountsBalanceGet.mockResolvedValue({ data: { accounts } })
  mocks.liabilitiesGet.mockResolvedValue({ data: { liabilities: { credit: [] } } })
}

const cardUpdates = (calls: RecordedCall[]) =>
  calls.filter((c) => c.table === 'cards' && c.op === 'update')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId = 'user_aaa'
})

// ── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/plaid/sync — auth', () => {
  it('rejects an unauthenticated request', async () => {
    mocks.userId = null
    setup()

    const res = await POST()

    expect(res.status).toBe(401)
    // Nothing may touch the database before identity is established.
    expect(mocks.supabase!.calls).toHaveLength(0)
  })

  it('never calls Plaid when unauthenticated', async () => {
    mocks.userId = null
    setup()

    await POST()

    expect(mocks.accountsBalanceGet).not.toHaveBeenCalled()
  })
})

describe('POST /api/plaid/sync — tenant isolation', () => {
  it('scopes every database call to the signed-in user', async () => {
    setup()

    await POST()

    // The service-role key bypasses RLS, so this filter is the ONLY thing
    // keeping one user's cards away from another's. Assert it on every call.
    for (const call of mocks.supabase!.calls) {
      expect(call.filters.user_id, `${call.op} on ${call.table} is unscoped`).toBe(
        'user_aaa'
      )
    }
  })

  it('uses the caller id, not a value from the request', async () => {
    mocks.userId = 'user_bbb'
    setup()

    await POST()

    const scoped = mocks.supabase!.calls.map((c) => c.filters.user_id)
    expect(new Set(scoped)).toEqual(new Set(['user_bbb']))
  })
})

describe('POST /api/plaid/sync — credit limits', () => {
  it("writes Plaid's limit when the user has not set one", async () => {
    setup()

    await POST()

    const [update] = cardUpdates(mocks.supabase!.calls)
    expect(update.payload).toMatchObject({ balance_limit: 5000 })
  })

  it('does not write a null limit over a stored one', async () => {
    // The regression: Plaid reports no limit for plenty of cards, and writing
    // that null through erased whatever the user had typed in.
    setup({ accounts: [account({ balances: { current: 1000, available: null, limit: null } })] })

    await POST()

    const [update] = cardUpdates(mocks.supabase!.calls)
    expect(update.payload).not.toHaveProperty('balance_limit')
  })

  it('leaves a user-entered limit alone even when Plaid reports one', async () => {
    setup({ cards: [{ plaid_account_id: 'acct_1', limit_is_manual: true }] })

    await POST()

    const [update] = cardUpdates(mocks.supabase!.calls)
    expect(update.payload).not.toHaveProperty('balance_limit')
  })

  it('still updates balances when it skips the limit', async () => {
    // Skipping the limit must not skip the rest of the sync.
    setup({ cards: [{ plaid_account_id: 'acct_1', limit_is_manual: true }] })

    await POST()

    const [update] = cardUpdates(mocks.supabase!.calls)
    expect(update.payload).toMatchObject({ balance_current: 1000 })
    expect(update.payload).toHaveProperty('last_synced_at')
  })
})

describe('POST /api/plaid/sync — failure handling', () => {
  it('reports a Plaid error code instead of throwing', async () => {
    setup()
    mocks.accountsBalanceGet.mockRejectedValue({
      response: { data: { error_code: 'ITEM_LOGIN_REQUIRED' } },
    })

    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.failed).toBe(1)
    expect(body.failures[0]).toMatchObject({
      institution: 'Chase',
      code: 'ITEM_LOGIN_REQUIRED',
      // Retrying will never clear this one — it needs the user to re-auth.
      needsReauth: true,
    })
  })

  it('does not flag an ordinary error as needing re-authentication', async () => {
    setup()
    mocks.accountsBalanceGet.mockRejectedValue({
      response: { data: { error_code: 'INTERNAL_SERVER_ERROR' } },
    })

    const body = await (await POST()).json()

    expect(body.failures[0].needsReauth).toBe(false)
  })

  it('keeps balances when the optional liabilities call fails', async () => {
    // Not every institution exposes Liabilities; that must not lose balances.
    setup()
    mocks.liabilitiesGet.mockRejectedValue(new Error('PRODUCTS_NOT_SUPPORTED'))

    const res = await POST()
    const body = await res.json()

    expect(body.synced).toBe(1)
    expect(cardUpdates(mocks.supabase!.calls)[0].payload).toMatchObject({
      balance_current: 1000,
    })
  })

  it('writes one row per account rather than one per connection', async () => {
    setup({
      cards: [
        { plaid_account_id: 'acct_1', limit_is_manual: false },
        { plaid_account_id: 'acct_2', limit_is_manual: false },
      ],
      accounts: [account(), account({ account_id: 'acct_2' })],
    })

    await POST()

    expect(cardUpdates(mocks.supabase!.calls)).toHaveLength(2)
  })
})
