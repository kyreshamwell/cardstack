// lib/csv.ts: parsing helpers for bank CSV exports.
//
// Bank CSVs are not consistent with each other. Descriptions contain commas and
// are quoted; amounts show up as "$1,234.56", "-50.00", or "(50.00)" for a
// negative; dates arrive as ISO, US, or two-digit-year. These helpers normalize
// all of it, and return null rather than guessing when a value is unreadable.

/**
 * Parses CSV text into rows of fields, honoring quoted fields and escaped
 * quotes (`""`). A plain split on commas breaks on any description containing
 * one, which is most of them.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }

    field += ch
    i++
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully blank lines. Trailing newlines are near-universal in exports.
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Reads a monetary value, returning null if it isn't a number.
 *
 * Accounting notation wraps negatives in parentheses, so "(50.00)" is -50.
 *
 * @example
 *   parseAmount('$1,234.56')  // 1234.56
 *   parseAmount('(50.00)')    // -50
 *   parseAmount('-12.99')     // -12.99
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null

  let negative = false

  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }

  s = s.replace(/[$,\s]/g, '')

  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  // Require a bare number by this point. Number() alone is too permissive:
  // it accepts a second sign, so "--5" parsed as -5 and then got negated back
  // to a positive 5, so malformed input silently imported as a real charge.
  if (!/^\d*\.?\d+$/.test(s)) return null

  const n = Number(s)
  if (!Number.isFinite(n)) return null

  return negative ? -n : n
}

/**
 * Normalizes a date to YYYY-MM-DD, or null if unreadable.
 *
 * Ambiguous slash dates are read as US month-first, which is what US bank
 * exports use, and the only kind this app connects to.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }

  const us = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (us) {
    const month = us[1].padStart(2, '0')
    const day = us[2].padStart(2, '0')
    const year = us[3].length === 2 ? `20${us[3]}` : us[3]
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

/** Column names worth pre-selecting, in priority order. */
export const COLUMN_HINTS = {
  date: ['transaction date', 'post date', 'posted date', 'date'],
  description: ['description', 'merchant', 'name', 'payee', 'memo'],
  amount: ['amount', 'debit', 'transaction amount'],
}

/** Best-guess column index for a field, or -1. */
export function guessColumn(headers: string[], hints: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const hint of hints) {
    const exact = lower.indexOf(hint)
    if (exact !== -1) return exact
  }
  for (const hint of hints) {
    const partial = lower.findIndex((h) => h.includes(hint))
    if (partial !== -1) return partial
  }
  return -1
}
