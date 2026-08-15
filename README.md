# Cardstack

> Your credit card command center.

One dashboard for every credit card you carry — balances, due dates, and the
utilization that actually moves your credit score. Built as a portfolio project
targeting fintech engineering roles.

**[Try the demo](/demo)** — the real dashboard on sample data. No sign-up, no
redirect. It renders the same components the signed-in app does, so it can't
drift from the real thing.

---

## Features

- **Connect via Plaid** or add cards by hand — mix and match
- **Utilization first** — cards sort by what moves your score, not by name
- **Lower reported utilization** — utilization is reported when a statement
  *closes*, not when payment is due, so the dashboard says what to pay before
  that date and what it buys you (`77% → 30%`)
- **Balance chart** — click a slice or legend row to isolate one card
- **Recent activity and detected subscriptions**, normalized to a monthly figure
- **Privacy mode** — one tap blurs every figure on screen, for screen-sharing
- **Dark mode** — follows your device, applied before first paint (no flash)
- **Sign in with Google, Apple, or email**, all resolving to one account
- **Desktop fits one screen and never scrolls**; phones get a tabbed layout with
  ordinary document scrolling

---

## Stack

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components and API routes in one repo |
| Language | TypeScript | Type safety on financial data |
| Auth | Clerk | Hosted sessions, social login, MFA |
| Financial API | Plaid | Sandbox → production path |
| Database | Supabase (Postgres + RLS) | Row-level security on user data |
| Styling | Tailwind CSS 4 | CSS-first tokens, no config file |
| Animation | Motion | Springs for the public page transitions |
| Testing | Vitest + Playwright | Logic, components, and a real browser |
| Deployment | Vercel | Preview deployments per PR |

---

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill it in — see below
npm run dev
```

Open <http://localhost:3000>. `/demo` works immediately with no keys at all;
signing in needs Clerk, and connecting a card needs Plaid and Supabase.

### Environment variables

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `SIGN_UP_URL` | `/sign-in`, `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `AFTER_SIGN_UP_URL` | `/dashboard` |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | [Plaid dashboard](https://dashboard.plaid.com) → Keys |
| `PLAID_ENV` | `sandbox` to start |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — **server-only, never expose** |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in development |

Run `docs/schema.sql` in Supabase's SQL editor to create the tables and
policies.

Social login is enabled in Clerk's dashboard under **Configure → SSO
Connections**, not in code. Development uses Clerk's shared credentials;
production requires your own Google Cloud OAuth client and, for Apple, a
Services ID and key from an Apple Developer account.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm test` | Unit + component tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright, on :3100) |
| `npm run test:all` | Everything |

---

## Project structure

```
app/
├── layout.tsx                # Root: ClerkProvider, fonts, pre-paint theme script
├── (marketing)/              # Public surface — landing, demo, auth
│   ├── layout.tsx            # Renders MarketingFrame; the pages render null
│   ├── page.tsx              # /            — owns the signed-in redirect
│   ├── demo/page.tsx         # /demo
│   └── sign-in|sign-up/      # Clerk catch-all routes
├── (dashboard)/              # Protected surface
│   ├── layout.tsx            # AppShell + account button
│   └── dashboard/page.tsx    # Queries Supabase, shapes rows into view props
├── sso-callback/page.tsx     # Where Google/Apple return to (must stay public)
└── api/
    ├── cards/                # Add, edit, remove, update limits
    ├── plaid/                # Link token, token exchange, sync
    └── transactions/         # CSV import

components/
├── dashboard/
│   ├── AppShell.tsx          # Nav + frame, shared by the app and the demo
│   └── DashboardView.tsx     # THE dashboard. No data fetching.
├── demo/
│   ├── DemoDashboard.tsx     # DashboardView + fixtures + gated buttons
│   └── DemoGate.tsx          # One shared "needs a real account" prompt
├── landing/
│   ├── MarketingFrame.tsx    # The three-panel filmstrip
│   ├── LandingHero.tsx       # The pitch
│   ├── CardStack.tsx         # Animated card stack
│   ├── Typewriter.tsx        # Headline typing, without layout shift
│   └── AuthPanel.tsx         # Clerk, embedded
├── cards/                    # Card tile, chart, lists, and the write buttons
└── charts/                   # Vendored bklit chart source (installed, not written)

lib/
├── utils.ts                  # Currency, utilization, due dates, statement close
├── cards.ts                  # Display order, identity colours, sync rules
├── demo-data.ts              # Demo fixtures, built from one timestamp
├── csv.ts                    # Bank CSV parsing
└── institutions.ts           # Bank → payment URL / app-open link

tests/                        # Vitest
├── helpers/supabase-fake.ts  # Records queries so tenant scoping is assertable
├── api/                      # Route handlers
└── components/               # jsdom + Testing Library

e2e/                          # Playwright
docs/
├── ARCHITECTURE.md           # How it fits together and why  ← read this
├── PRD.md                    # Product requirements
├── schema.sql                # Supabase tables + RLS policies
└── decisions/                # Architecture decision records
```

---

## Architecture

**[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** covers how the pieces fit and
why — including approaches that were tried and abandoned, so they don't get
proposed again.

The short version, and the two things most likely to surprise you:

- **The demo is the real dashboard.** `DashboardView` does no data fetching; the
  signed-in page passes Supabase rows in and the demo passes fixtures in.
  Anything needing a network is injected as a prop, because that's what the demo
  replaces.
- **All three public panels are mounted at once**, arranged as a horizontal
  filmstrip. So `[data-card-id]` finds the demo's rows from the landing page —
  scope queries with `data-panel` / `data-active`.

---

## Testing

```bash
npm test          # unit + component (Vitest)
npm run test:e2e  # browser (Playwright)
npm run test:all  # everything
```

Three layers, each covering what the one below it structurally cannot.

**Pure logic** — currency and utilization math, due-date boundaries,
statement-close prediction, recurring-cadence conversion, CSV parsing, and the
demo fixtures. Fast, no environment.

**API routes** — run against a fake Supabase client that records every query.
That design is deliberate: routes use the service-role key, which **bypasses
RLS**, so tenant isolation rests entirely on each query carrying
`.eq('user_id', …)`. Recording filters lets a test assert that directly. An
in-memory database could not — a query missing the filter still returns rows.

**Components (jsdom)** — prioritised by blast radius rather than visibility.
`ImportCsvButton` first, because its sign toggle silently turns every purchase
into a refund if it's wrong.

**End-to-end (Playwright)** — that the app boots, that middleware actually
redirects, that pages render without console errors, and that the phone layout
scrolls the document rather than a box. `/demo` is public, so most of this runs
with no credentials at all.

Signed-in tests live in `e2e/dashboard.spec.ts` and **skip until credentials are
set**:

```bash
E2E_CLERK_USER_EMAIL=e2e@yourdomain.test
E2E_CLERK_USER_PASSWORD=…
```

Create that user in Clerk and point it at a **seeded** Supabase project — not
your own account, since one of those tests deletes a card.

### Conventions

- **Mutation-test anything important.** Break the code deliberately and confirm
  exactly the intended test fails. It has caught vacuous tests here more than
  once.
- **Scope E2E assertions to the active panel** — see above.
- **Playwright runs two workers, not the CPU count.** The Next dev server
  compiles on demand and drops connections under more load, producing tests that
  pass alone and fail in the pack.

### Bugs these tests found

Written after the features, and they still caught real defects:

| Bug | Consequence |
|---|---|
| `parseAmount('--5')` returned `5` | Malformed CSV silently imported as a real charge |
| Sync wrote Plaid's `null` limit over a manual one | Wiped entered limits, blanking utilization everywhere |
| CSV error never rendered on the picker | Choosing a bad file appeared to do nothing at all |
| `daysUntil` measured hours, not calendar days | A card due today read "due tomorrow", then "overdue" after noon |
| Privacy mode never covered the chart | Balances stayed readable in the exact case the feature exists for |
| Demo fixtures read the wall clock | Hydration mismatch on every page load |

---

## Plaid sandbox

Plaid's sandbox lets you test the full bank connection flow without real
credentials:

- **Username:** `user_good`
- **Password:** `pass_good`
- **Institution:** any

Full list: <https://plaid.com/docs/sandbox/test-credentials/>

---

## Dev log

[DEVLOG.md](./DEVLOG.md) — a running log of what was built and decided each
session.
