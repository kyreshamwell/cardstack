// lib/demo-data.ts — the fixture account behind the public demo.
//
// Built to exercise every branch of the dashboard rather than to look tidy:
// there is a card over the 30% utilization target (so "Pay before close" has
// something to say), a card due soon (so the header shows its warning), a card
// with no limit reported (so utilization has to degrade gracefully), and a card
// at zero (so the sort's bottom tier is populated).
//
// Dates are relative to render time rather than hard-coded, so the demo never
// shows a statement that closed last year. They're built in LOCAL time on
// purpose — the components parse `${date}T12:00:00`, i.e. local noon, and
// toISOString() would push a late-in-the-day render onto tomorrow.
//
// Everything is a function of an explicit `now`, and that is not stylistic.
// These were module-level constants evaluated at import time, so the server
// computed them once when the module first loaded and the browser computed them
// again at hydration — two different clocks, minutes apart. The dashboard
// rendered "Updated 12 min ago" from the server and "8 min ago" on the client,
// and React threw a hydration mismatch on every single page load. Threading one
// timestamp through from the server render fixes it at the source: both sides
// do the same arithmetic on the same number.

import type { DashboardCard } from '@/components/dashboard/DashboardView'
import type { TransactionRow } from '@/components/cards/RecentTransactions'
import type { RecurringRow } from '@/components/cards/RecurringCharges'
import { colorsByCardId } from '@/lib/cards'

/** A YYYY-MM-DD date `n` days from `now`, in local time. */
function day(now: number, n: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + n)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${date}`
}

/** An ISO timestamp `n` hours before `now` — used for "new since last visit". */
function hoursAgo(now: number, n: number): string {
  return new Date(now - n * 3600_000).toISOString()
}

export interface DemoData {
  cards: DashboardCard[]
  colors: Record<string, string>
  cardNames: Record<string, string>
  transactions: TransactionRow[]
  recurring: RecurringRow[]
  /** Two days back, which puts the four most recent transactions inside "new". */
  lastViewed: string
  /** Recent enough that the header reads "Updated 8 min ago". */
  lastSynced: string
}

/**
 * Builds the whole fixture account from one timestamp.
 *
 * Pass the SAME `now` on the server and on the client — see the note at the top
 * of this file for what happens otherwise.
 */
export function buildDemoData(now: number): DemoData {
  const cards: DashboardCard[] = [
    {
      id: 'demo-sapphire',
      name: 'Sapphire Preferred',
      institutionName: 'Chase',
      mask: '9141',
      isManual: false,
      balance_current: 3860,
      balance_available: 1140,
      balance_limit: 5000,
      statement_balance: 3410,
      statement_date: day(now, -24), // closes in ~6 days
      minimum_payment: 96,
      due_date: day(now, 4), // due soon
    },
    {
      id: 'demo-platinum',
      name: 'Platinum',
      institutionName: 'American Express',
      mask: '4823',
      isManual: false,
      balance_current: 2180,
      balance_available: 7820,
      balance_limit: 10000,
      statement_balance: 1950,
      statement_date: day(now, -11),
      minimum_payment: 55,
      due_date: day(now, 17),
    },
    {
      id: 'demo-quicksilver',
      name: 'Quicksilver',
      institutionName: 'Capital One',
      mask: '2267',
      isManual: false,
      balance_current: 612,
      balance_available: 4388,
      balance_limit: 5000,
      statement_balance: 540,
      statement_date: day(now, -18),
      minimum_payment: 25,
      due_date: day(now, 11),
    },
    {
      // Added by hand, so no limit came from anywhere — the utilization ring
      // has nothing to draw and the row has to stay readable regardless.
      id: 'demo-store',
      name: 'Store Card',
      institutionName: 'Synchrony Bank',
      mask: null,
      isManual: true,
      balance_current: 289,
      balance_available: null,
      balance_limit: null,
      statement_balance: null,
      statement_date: null,
      minimum_payment: 25,
      due_date: day(now, 9),
    },
    {
      id: 'demo-doublecash',
      name: 'Double Cash',
      institutionName: 'Citi',
      mask: '7702',
      isManual: false,
      balance_current: 0,
      balance_available: 3000,
      balance_limit: 3000,
      statement_balance: 0,
      statement_date: day(now, -7),
      minimum_payment: 0,
      due_date: day(now, 21),
    },
  ]

  // Plaid's sign convention: POSITIVE is money out, NEGATIVE is money in — so
  // the payments read as credits. The first four sit inside the "new since last
  // visit" window set by `lastViewed`, which is what shows the "4 new" marker.
  const transactions: TransactionRow[] = [
    {
      id: 'tx-1',
      card_id: 'demo-sapphire',
      name: 'UNITED AIRLINES',
      merchant_name: 'United',
      amount: 428.6,
      transaction_date: day(now, 0),
      pending: true,
      category: 'Travel',
      created_at: hoursAgo(now, 2),
    },
    {
      id: 'tx-2',
      card_id: 'demo-platinum',
      name: 'WHOLE FOODS MKT',
      merchant_name: 'Whole Foods',
      amount: 96.14,
      transaction_date: day(now, 0),
      pending: false,
      category: 'Groceries',
      created_at: hoursAgo(now, 5),
    },
    {
      id: 'tx-3',
      card_id: 'demo-quicksilver',
      name: 'SHELL OIL 574',
      merchant_name: 'Shell',
      amount: 61.2,
      transaction_date: day(now, -1),
      pending: false,
      category: 'Gas',
      created_at: hoursAgo(now, 20),
    },
    {
      id: 'tx-4',
      card_id: 'demo-sapphire',
      name: 'PAYMENT THANK YOU',
      merchant_name: null,
      amount: -600,
      transaction_date: day(now, -1),
      pending: false,
      category: 'Payment',
      created_at: hoursAgo(now, 26),
    },
    {
      id: 'tx-5',
      card_id: 'demo-platinum',
      name: 'NETFLIX.COM',
      merchant_name: 'Netflix',
      amount: 22.99,
      transaction_date: day(now, -2),
      pending: false,
      category: 'Entertainment',
      created_at: hoursAgo(now, 70),
    },
    {
      id: 'tx-6',
      card_id: 'demo-sapphire',
      name: 'BLUE BOTTLE COFFEE',
      merchant_name: 'Blue Bottle',
      amount: 8.75,
      transaction_date: day(now, -2),
      pending: false,
      category: 'Dining',
      created_at: hoursAgo(now, 72),
    },
    {
      id: 'tx-7',
      card_id: 'demo-store',
      name: 'SYNCHRONY STORE 88',
      merchant_name: null,
      amount: 143.2,
      transaction_date: day(now, -3),
      pending: false,
      category: 'Shopping',
      created_at: hoursAgo(now, 90),
    },
    {
      id: 'tx-8',
      card_id: 'demo-quicksilver',
      name: 'TRADER JOES 442',
      merchant_name: "Trader Joe's",
      amount: 74.31,
      transaction_date: day(now, -4),
      pending: false,
      category: 'Groceries',
      created_at: hoursAgo(now, 110),
    },
    {
      id: 'tx-9',
      card_id: 'demo-platinum',
      name: 'UBER TRIP',
      merchant_name: 'Uber',
      amount: 19.4,
      transaction_date: day(now, -4),
      pending: false,
      category: 'Travel',
      created_at: hoursAgo(now, 112),
    },
    {
      id: 'tx-10',
      card_id: 'demo-sapphire',
      name: 'SPOTIFY USA',
      merchant_name: 'Spotify',
      amount: 11.99,
      transaction_date: day(now, -5),
      pending: false,
      category: 'Entertainment',
      created_at: hoursAgo(now, 130),
    },
    {
      id: 'tx-11',
      card_id: 'demo-doublecash',
      name: 'PAYMENT THANK YOU',
      merchant_name: null,
      amount: -412.5,
      transaction_date: day(now, -6),
      pending: false,
      category: 'Payment',
      created_at: hoursAgo(now, 150),
    },
    {
      id: 'tx-12',
      card_id: 'demo-quicksilver',
      name: 'CVS PHARMACY 2210',
      merchant_name: 'CVS',
      amount: 32.18,
      transaction_date: day(now, -7),
      pending: false,
      category: 'Health',
      created_at: hoursAgo(now, 170),
    },
    {
      id: 'tx-13',
      card_id: 'demo-platinum',
      name: 'DELTA AIR LINES',
      merchant_name: 'Delta',
      amount: 318,
      transaction_date: day(now, -8),
      pending: false,
      category: 'Travel',
      created_at: hoursAgo(now, 196),
    },
    {
      id: 'tx-14',
      card_id: 'demo-sapphire',
      name: 'AMZN MKTP US',
      merchant_name: 'Amazon',
      amount: 58.42,
      transaction_date: day(now, -9),
      pending: false,
      category: 'Shopping',
      created_at: hoursAgo(now, 220),
    },
    {
      id: 'tx-15',
      card_id: 'demo-quicksilver',
      name: 'CHIPOTLE 1188',
      merchant_name: 'Chipotle',
      amount: 14.85,
      transaction_date: day(now, -10),
      pending: false,
      category: 'Dining',
      created_at: hoursAgo(now, 244),
    },
    {
      id: 'tx-16',
      card_id: 'demo-platinum',
      name: 'PLANET FITNESS',
      merchant_name: 'Planet Fitness',
      amount: 24.99,
      transaction_date: day(now, -11),
      pending: false,
      category: 'Health',
      created_at: hoursAgo(now, 268),
    },
    {
      id: 'tx-17',
      card_id: 'demo-store',
      name: 'REFUND — RETURN',
      merchant_name: null,
      amount: -49.99,
      transaction_date: day(now, -12),
      pending: false,
      category: 'Shopping',
      created_at: hoursAgo(now, 292),
    },
    {
      id: 'tx-18',
      card_id: 'demo-sapphire',
      name: 'CLAUDE PRO',
      merchant_name: 'Anthropic',
      amount: 20,
      transaction_date: day(now, -13),
      pending: false,
      category: 'Software',
      created_at: hoursAgo(now, 316),
    },
  ]

  const recurring: RecurringRow[] = [
    {
      id: 'rec-1',
      card_id: 'demo-sapphire',
      description: 'SPOTIFY USA',
      merchant_name: 'Spotify',
      frequency: 'MONTHLY',
      average_amount: 11.99,
      last_amount: 11.99,
      predicted_next_date: day(now, 12),
      status: 'MATURE',
    },
    {
      id: 'rec-2',
      card_id: 'demo-platinum',
      description: 'NETFLIX.COM',
      merchant_name: 'Netflix',
      frequency: 'MONTHLY',
      average_amount: 22.99,
      last_amount: 22.99,
      predicted_next_date: day(now, 16),
      status: 'MATURE',
    },
    {
      id: 'rec-3',
      card_id: 'demo-platinum',
      description: 'PLANET FITNESS',
      merchant_name: 'Planet Fitness',
      frequency: 'MONTHLY',
      average_amount: 24.99,
      last_amount: 24.99,
      predicted_next_date: day(now, 19),
      status: 'MATURE',
    },
    {
      id: 'rec-4',
      card_id: 'demo-sapphire',
      description: 'CLAUDE PRO',
      merchant_name: 'Anthropic',
      frequency: 'MONTHLY',
      average_amount: 20,
      last_amount: 20,
      predicted_next_date: day(now, 14),
      status: 'MATURE',
    },
    {
      // Annual, so the list has to normalize it to a monthly figure to rank it
      // against the others — that normalization is the point of the panel.
      id: 'rec-5',
      card_id: 'demo-quicksilver',
      description: 'AMZN PRIME MEMBERSHIP',
      merchant_name: 'Amazon',
      frequency: 'ANNUALLY',
      average_amount: 139,
      last_amount: 139,
      predicted_next_date: day(now, 68),
      status: 'MATURE',
    },
  ]

  return {
    cards,
    cardNames: Object.fromEntries(cards.map((c) => [c.id, c.name])),
    colors: colorsByCardId(cards.map((c) => c.id)),
    lastSynced: new Date(now - 8 * 60_000).toISOString(),
    lastViewed: hoursAgo(now, 48),
    recurring,
    transactions,
  }
}
