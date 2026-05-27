# Cardstack

> Your credit card command center.

A single dashboard for managing multiple credit cards — balances, due dates, and credit utilization at a glance. Built as a portfolio project targeting fintech engineering roles.

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
├── (auth)/                   # Sign-in and sign-up (Clerk components)
├── (dashboard)/              # Protected routes — main app UI
│   ├── layout.tsx            # Nav + page chrome for all dashboard routes
│   └── page.tsx              # /dashboard — card grid
└── api/                      # API routes (Plaid, webhooks) — added later

lib/
└── utils.ts                  # Pure utility functions (currency, utilization, due dates)

docs/
├── PRD.md                    # Product requirements
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
