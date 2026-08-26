// tests/helpers/supabase-fake.ts
//
// A minimal stand-in for the Supabase client, built for asserting on WHAT a
// route wrote and WHICH filters it used, not for simulating Postgres.
//
// That focus is deliberate. The failure we most need to catch is a query that
// forgets `.eq('user_id', …)`: every route uses the service-role key, which
// bypasses RLS, so that filter is the only thing standing between one user and
// another user's financial data. Recording filters catches it directly; a full
// in-memory database would not, because a missing filter still returns rows.

export type Row = Record<string, unknown>

export interface RecordedCall {
  table: string
  op: 'select' | 'update' | 'upsert' | 'insert' | 'delete'
  filters: Record<string, unknown>
  payload?: unknown
  /** Second argument to upsert/insert, e.g. { onConflict }. */
  options?: unknown
}

interface Options {
  /** Rows returned by a select on a given table. */
  reads?: Record<string, Row[]>
  /**
   * Force a write to a given table to fail. Needed to prove that a route
   * doesn't advance its sync cursor past data it never managed to store.
   */
  writeErrors?: Record<string, { message: string }>
}

export function createFakeSupabase(options: Options = {}) {
  const calls: RecordedCall[] = []
  const reads = options.reads ?? {}
  const writeErrors = options.writeErrors ?? {}

  function builder(
    table: string,
    op: RecordedCall['op'],
    payload?: unknown,
    callOptions?: unknown
  ) {
    const filters: Record<string, unknown> = {}
    calls.push({ table, op, filters, payload, options: callOptions })

    // A write that chains .select() returns the rows it affected, which is how
    // routes tell a real update apart from one that matched nothing.
    let selected = op === 'select'
    const rows = () => (selected ? (reads[table] ?? []) : [])

    // Thenable so `await` on the chain resolves like the real client, while
    // eq/order/limit stay chainable.
    const api = {
      eq(column: string, value: unknown) {
        filters[column] = value
        return api
      },
      in(column: string, values: unknown[]) {
        filters[column] = values
        return api
      },
      order() {
        return api
      },
      limit() {
        return api
      },
      maybeSingle() {
        return Promise.resolve({ data: rows()[0] ?? null, error: null })
      },
      single() {
        return Promise.resolve({ data: rows()[0] ?? null, error: null })
      },
      select() {
        selected = true
        return api
      },
      then<T>(resolve: (v: { data: Row[] | null; error: unknown }) => T) {
        const failure = op !== 'select' ? writeErrors[table] : undefined
        return Promise.resolve(
          failure ? { data: null, error: failure } : { data: rows(), error: null }
        ).then(resolve)
      },
    }

    return api
  }

  const client = {
    from(table: string) {
      return {
        select: () => builder(table, 'select'),
        update: (payload: unknown) => builder(table, 'update', payload),
        upsert: (payload: unknown, opts?: unknown) =>
          builder(table, 'upsert', payload, opts),
        insert: (payload: unknown, opts?: unknown) =>
          builder(table, 'insert', payload, opts),
        delete: () => builder(table, 'delete'),
      }
    },
  }

  return {
    client,
    calls,
    /** Every call that wrote to the database. */
    writes: () => calls.filter((c) => c.op !== 'select'),
    /** Calls touching a given table. */
    forTable: (table: string) => calls.filter((c) => c.table === table),
  }
}
