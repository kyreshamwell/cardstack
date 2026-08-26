'use client'
// components/cards/ImportCsvButton.tsx
//
// Imports a bank CSV for a card Plaid can't reach.
//
// The sign convention is asked, not guessed. Banks disagree about whether a
// purchase is +50 or -50, and guessing wrong turns every purchase into a
// refund, silently, with no error. The preview shows a real row from the file
// so the choice can be checked against actual data before anything is written.

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { parseCsv, parseAmount, parseDate, guessColumn, COLUMN_HINTS } from '@/lib/csv'
import { formatCurrency } from '@/lib/utils'

interface CardOption {
  id: string
  name: string
}

interface Props {
  cards: CardOption[]
}

type Mapping = { date: number; description: number; amount: number }

export function ImportCsvButton({ cards }: Props) {
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({ date: -1, description: -1, amount: -1 })
  const [cardId, setCardId] = useState<string>(cards[0]?.id ?? '')
  const [purchasesArePositive, setPurchasesArePositive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function reset() {
    setFileName(null)
    setHeaders([])
    setDataRows([])
    setMapping({ date: -1, description: -1, amount: -1 })
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(file: File) {
    setError(null)
    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length < 2) {
      setError('That file has no data rows.')
      return
    }

    const head = rows[0]
    setFileName(file.name)
    setHeaders(head)
    setDataRows(rows.slice(1))
    setMapping({
      date: guessColumn(head, COLUMN_HINTS.date),
      description: guessColumn(head, COLUMN_HINTS.description),
      amount: guessColumn(head, COLUMN_HINTS.amount),
    })
  }

  const ready = mapping.date >= 0 && mapping.description >= 0 && mapping.amount >= 0 && cardId

  // Parse with the current mapping so the preview and the import agree exactly.
  const parsed = ready
    ? dataRows.map((r) => {
        const date = parseDate(r[mapping.date] ?? '')
        const raw = parseAmount(r[mapping.amount] ?? '')
        const description = (r[mapping.description] ?? '').trim()
        if (!date || raw === null || !description) return null
        // Stored convention is Plaid's: positive = money out.
        const amount = purchasesArePositive ? raw : -raw
        return { date, description, amount }
      })
    : []

  const valid = parsed.filter((r): r is NonNullable<typeof r> => r !== null)
  const unreadable = parsed.length - valid.length
  const sample = valid[0]

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, rows: valid }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
        return
      }
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  if (cards.length === 0) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-ground px-3 py-2 text-sm font-medium text-ink-2 hover:bg-raised transition-colors"
      >
        Import
      </button>
    )
  }

  const selectClass =
    'w-full rounded-lg border border-line bg-ground px-2.5 py-1.5 text-sm text-ink'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-ground border border-line p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Import transactions
            </h2>
            <p className="mt-0.5 text-xs text-ink-2">
              For cards Plaid can&apos;t connect to.
            </p>
          </div>
          <button
            onClick={() => {
              setOpen(false)
              reset()
            }}
            className="text-sm text-ink-3 hover:text-ink"
          >
            Close
          </button>
        </div>

        {!fileName ? (
          <div className="mt-5">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-ground"
            />
            <p className="mt-2 text-xs text-ink-3">
              Export from your bank as CSV, then pick the file here.
            </p>
            {/* A rejected file leaves fileName unset, so this branch has to
                show the error too. Otherwise picking a bad CSV appears to do
                nothing at all. */}
            {error && <p className="mt-2 text-xs text-critical">{error}</p>}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-ink-2">
              {fileName} · {dataRows.length} rows
            </p>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">
                Card
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className={selectClass}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['date', 'description', 'amount'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-ink-2 mb-1 capitalize">
                    {field}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field]: Number(e.target.value) })
                    }
                    className={selectClass}
                  >
                    <option value={-1}>Choose…</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">
                In this file, purchases are
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPurchasesArePositive(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    !purchasesArePositive
                      ? 'border-ink bg-ink text-ground'
                      : 'border-line text-ink-2'
                  }`}
                >
                  Negative (−50)
                </button>
                <button
                  onClick={() => setPurchasesArePositive(true)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    purchasesArePositive
                      ? 'border-ink bg-ink text-ground'
                      : 'border-line text-ink-2'
                  }`}
                >
                  Positive (50)
                </button>
              </div>
            </div>

            {sample && (
              <div className="rounded-lg bg-raised p-3">
                <p className="text-xs font-medium text-ink-2 mb-1.5">
                  First row reads as
                </p>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink">
                    {sample.description}
                  </span>
                  <span
                    className={`sensitive-value shrink-0 font-semibold tabular-nums ${
                      sample.amount < 0
                        ? 'text-good'
                        : 'text-ink'
                    }`}
                  >
                    {sample.amount < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(sample.amount))}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-ink-3">
                  {sample.date} ·{' '}
                  {sample.amount < 0
                    ? 'treated as a payment or refund'
                    : 'treated as a purchase'}
                </p>
              </div>
            )}

            {ready && (
              <p className="text-xs text-ink-2">
                {valid.length} rows ready
                {unreadable > 0 && ` · ${unreadable} skipped as unreadable`}
              </p>
            )}

            {error && <p className="text-xs text-critical">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={reset}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2"
              >
                Pick another file
              </button>
              <button
                onClick={handleImport}
                disabled={!ready || valid.length === 0 || busy}
                className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-ground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Importing…' : `Import ${valid.length} rows`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
