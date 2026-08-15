// tests/csv.test.ts
//
// Bank CSV parsing — the highest-consequence pure logic in the project.
//
// Getting the sign convention backwards doesn't throw or warn: it silently
// imports every purchase as a refund and understates what you owe. The parser
// also has to survive real bank exports, which means quoted fields containing
// commas, inconsistent date formats, and rows that are simply unreadable.
//
import { describe, expect, it } from 'vitest'
import { parseCsv, parseAmount, parseDate, guessColumn, COLUMN_HINTS } from '@/lib/csv'

describe('parseCsv', () => {
  it('parses a plain file', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps commas inside quoted fields together', () => {
    // The reason a split(',') implementation cannot be used: most bank
    // descriptions contain commas.
    expect(parseCsv('date,description\n08/09,"SHELL OIL, STORE 42"')).toEqual([
      ['date', 'description'],
      ['08/09', 'SHELL OIL, STORE 42'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([['a'], ['He said "hi"']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('preserves newlines inside a quoted field', () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([['a'], ['line1\nline2']])
  })

  it('drops blank trailing lines rather than emitting empty rows', () => {
    expect(parseCsv('a,b\n1,2\n\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('preserves empty cells within a real row', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })

  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('parseAmount', () => {
  it('strips currency symbols and separators', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56)
  })

  it('reads accounting parentheses as negative', () => {
    expect(parseAmount('(50.00)')).toBe(-50)
    expect(parseAmount('($1,234.56)')).toBe(-1234.56)
  })

  it('reads explicit signs', () => {
    expect(parseAmount('-12.99')).toBe(-12.99)
    expect(parseAmount('+12.99')).toBe(12.99)
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseAmount('  42.00  ')).toBe(42)
  })

  it('returns null for anything unreadable instead of NaN', () => {
    // NaN would flow into the DB as a corrupt amount; null gets the row skipped.
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('n/a')).toBeNull()
    expect(parseAmount('--5')).toBeNull()
  })

  it('reads zero as zero, not as missing', () => {
    expect(parseAmount('0.00')).toBe(0)
  })
})

describe('parseDate', () => {
  it('passes ISO dates through', () => {
    expect(parseDate('2026-08-09')).toBe('2026-08-09')
  })

  it('zero-pads single-digit ISO parts', () => {
    expect(parseDate('2026-8-9')).toBe('2026-08-09')
  })

  it('reads US slash dates as month-first', () => {
    expect(parseDate('08/09/2026')).toBe('2026-08-09')
    expect(parseDate('8/9/2026')).toBe('2026-08-09')
  })

  it('expands two-digit years', () => {
    expect(parseDate('08/09/26')).toBe('2026-08-09')
  })

  it('accepts dash and dot separators', () => {
    expect(parseDate('08-09-2026')).toBe('2026-08-09')
    expect(parseDate('08.09.2026')).toBe('2026-08-09')
  })

  it('returns null for unreadable input rather than a wrong date', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('not a date')).toBeNull()
  })
})

describe('guessColumn', () => {
  it('prefers an exact header match', () => {
    const headers = ['Post Date', 'Transaction Date', 'Description', 'Amount']
    // "transaction date" outranks "post date" in the hint order.
    expect(guessColumn(headers, COLUMN_HINTS.date)).toBe(1)
  })

  it('is case and whitespace insensitive', () => {
    expect(guessColumn(['  AMOUNT  '], COLUMN_HINTS.amount)).toBe(0)
  })

  it('falls back to a partial match', () => {
    expect(guessColumn(['Txn Amount (USD)'], COLUMN_HINTS.amount)).toBe(0)
  })

  it('returns -1 when nothing matches, so the user is asked to map it', () => {
    expect(guessColumn(['foo', 'bar'], COLUMN_HINTS.date)).toBe(-1)
  })
})
