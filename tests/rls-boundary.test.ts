// tests/rls-boundary.test.ts
//
// A source sweep, not a behaviour test. It guards the one rule that makes Row
// Level Security meaningful in this codebase:
//
//   supabaseAdmin bypasses RLS entirely. It may only ever query
//   connected_accounts — the table holding plaid_access_token, which the
//   user-level Postgres role must never be able to read.
//
// Everything else goes through supabaseForUser(), where the policies in
// docs/migrations/001-rls-write-policies.sql actually run.
//
// Why a source sweep rather than a runtime test: the failure this catches is a
// query written six months from now that reaches for the nearest client and
// gets a superuser. Nothing at runtime would complain — it would work, and it
// would return every user's rows. The only moment to catch it is in review, and
// this test is that review.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

/** The only table the service-role client is allowed to touch. */
const ADMIN_ONLY_TABLE = 'connected_accounts'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry)
    if (statSync(join(ROOT, rel)).isDirectory()) {
      out.push(...sourceFiles(rel))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(rel)
    }
  }
  return out
}

const files = [...sourceFiles('app'), ...sourceFiles('lib')].filter(
  (f) => f !== join('lib', 'supabase.ts')
)

/**
 * Finds `supabaseAdmin ... .from('table')` and returns each table named.
 * Deliberately crude: it looks at the next `.from(...)` after each mention,
 * which is how every call site in this codebase is written.
 */
function adminTables(source: string): string[] {
  const tables: string[] = []
  const re = /supabaseAdmin[\s\S]{0,200}?\.from\(\s*['"]([a-z_]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) tables.push(m[1])
  return tables
}

describe('service-role client stays inside its blast radius', () => {
  it('finds the call sites it is meant to be checking', () => {
    // Guards against the sweep silently passing because the regex stopped
    // matching — an empty sweep is a broken sweep, not a clean bill of health.
    const total = files
      .map((f) => adminTables(readFileSync(join(ROOT, f), 'utf8')).length)
      .reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
  })

  it.each(files)('%s queries only connected_accounts with supabaseAdmin', (file) => {
    const tables = adminTables(readFileSync(join(ROOT, file), 'utf8'))
    const offenders = tables.filter((t) => t !== ADMIN_ONLY_TABLE)

    expect(
      offenders,
      `${file} uses supabaseAdmin (which bypasses RLS) to query ` +
        `${offenders.join(', ')}. Use supabaseForUser() so the database ` +
        `enforces ownership. Only ${ADMIN_ONLY_TABLE} is exempt, because it ` +
        `stores plaid_access_token.`
    ).toEqual([])
  })
})

describe('the user-level client is what the app actually runs on', () => {
  it('is used by the dashboard page', () => {
    const page = readFileSync(join(ROOT, 'app/(dashboard)/dashboard/page.tsx'), 'utf8')
    expect(page).toContain('supabaseForUser')
    expect(page).not.toMatch(/supabaseAdmin/)
  })

  it('is used by every route that writes user-owned rows', () => {
    const writeRoutes = [
      'app/api/cards/add-manual/route.ts',
      'app/api/cards/update-limit/route.ts',
      'app/api/cards/update-manual/route.ts',
      'app/api/cards/remove/route.ts',
      'app/api/transactions/import/route.ts',
      'app/api/viewed/route.ts',
    ]
    for (const route of writeRoutes) {
      expect(
        readFileSync(join(ROOT, route), 'utf8'),
        `${route} should acquire a user-scoped client`
      ).toContain('supabaseForUser')
    }
  })
})
