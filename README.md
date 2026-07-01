# Cardstack

> Your credit card command center.

A single dashboard for managing multiple credit cards — balances, due dates, and credit utilization at a glance. Built as a portfolio project targeting fintech engineering roles.

The landing page includes a **live interactive demo** with mock data — no sign-up required to try it.

---

## Features

- **Connect via Plaid** or add cards manually — mix and match
- **Utilization tracking**, per-card and overall, with color-coded thresholds
- **Balance breakdown donut chart** — click a slice or legend row to isolate a single card on screen
- **Privacy mode** — one tap blurs every dollar amount, for screen-sharing or public spaces
- **Dark mode**, synced with iOS Safari's status bar color
- **Due date alerts** (overdue / due soon / upcoming), auto-suppressed for $0 minimum payments
- **Pay this card** — opens the bank's real app when it supports it (Chase, Capital One), otherwise their real login page
- Mobile-first layout with iOS safe-area handling (no white bars top/bottom in Safari)

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Clerk |
| Financial API | Plaid |
| Database | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys (see table below).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `PLAID_CLIENT_ID` | [Plaid dashboard](https://dashboard.plaid.com) → Team Settings → Keys |
| `PLAID_SECRET` | Plaid dashboard (use the **Sandbox** key first) |
| `PLAID_ENV` | `sandbox` to start, `development` when ready for real accounts |
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase dashboard](https://supabase.com/dashboard) → Project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project → Settings → API |

---

## Project structure

```
app/
├── page.tsx                  # Landing page — hero + live interactive demo
├── (auth)/                   # Sign-in and sign-up (Clerk components)
├── (dashboard)/              # Protected routes — main app UI
│   ├── layout.tsx            # Nav + page chrome for all dashboard routes
│   └── page.tsx              # /dashboard — card grid, donut chart, overview
└── api/
    ├── cards/                # Add/edit/remove manual cards, update limits
    └── plaid/                # Link token creation, token exchange, sync

components/
├── DemoDashboard.tsx         # Landing-page demo — real components, mock data
├── DarkModeToggle.tsx
├── NavUserButton.tsx         # Custom pill avatar wrapping Clerk's UserButton
└── cards/
    ├── DonutChart.tsx        # Balance breakdown, click-to-isolate a card
    ├── CardFocusManager.tsx  # Shows/hides cards when a chart slice is clicked
    ├── PrivacyToggle.tsx     # Blurs sensitive-value elements app-wide
    ├── PayCardButton.tsx     # Opens the bank's app if supported, else website
    ├── ConnectCardButton.tsx / ManualLimitInput.tsx / EditManualCardButton.tsx
    └── AddManualCardButton.tsx / RemoveCardButton.tsx / RefreshButton.tsx

lib/
├── utils.ts                  # Pure utility functions (currency, utilization, due dates)
└── institutions.ts           # Bank name → payment URL / app-open link mapping

docs/
├── PRD.md                    # Product requirements
├── schema.sql                # Supabase table definitions
└── decisions/                # Architecture decision records
```

---

## Dev log

See [DEVLOG.md](./DEVLOG.md) for a running log of what was built and decided each session.

---

## Plaid sandbox

Plaid's sandbox environment lets you test the full bank connection flow without real credentials. Use these test credentials when prompted:

- **Username:** `user_good`
- **Password:** `pass_good`
- **Institution:** Any — Chase, BofA, etc.

Full list of sandbox credentials: https://plaid.com/docs/sandbox/test-credentials/
