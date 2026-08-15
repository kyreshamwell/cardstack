# Devlog

Running log of what was built, decided, and learned each session. Updated at the end of every work session.

---

## Session 1 — 2026-05-27

### What was built

- Manual scaffold: Next.js 15, TypeScript, Tailwind CSS 4, Clerk
- Root layout (`app/layout.tsx`) wrapping the whole app in `ClerkProvider`
- Public landing page (`app/page.tsx`) with sign in / sign up links
- Clerk auth pages using the `[[...slug]]` catch-all route pattern:
  - `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
  - `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Protected route group `(dashboard)` with a layout (nav + `UserButton`) and a placeholder page
- Clerk edge middleware (`middleware.ts`) that protects every route except `/`, `/sign-in`, and `/sign-up`
- `lib/utils.ts` with three core financial helpers:
  - `formatCurrency` — formats numbers as USD strings
  - `calcUtilization` — balance / limit × 100, with divide-by-zero guard
  - `getDueDateStatus` — returns `"overdue"`, `"due-soon"`, or `"upcoming"`

### Decisions made

| Decision | Reason |
|---|---|
| Manual file authoring over `create-next-app` | Learning goal: understand every file in the project |
| Tailwind 4 (CSS-first) | No `tailwind.config.ts` needed; design tokens live in `globals.css` via `@theme` |
| Route groups `(auth)` and `(dashboard)` | Creates separate layout trees without affecting URLs; auth pages don't inherit the nav shell |
| Clerk edge middleware | Auth check happens before any server component runs — no risk of leaking protected data |
| `[[...sign-in]]` catch-all routes | Clerk's multi-step flows navigate to sub-paths; catch-all serves them all from one file |

### What I learned

- Route groups `(name)` in Next.js App Router are directory-scoping, not URL segments
- Tailwind 4 shifts config from JS to CSS — design tokens go inside `@theme {}` in the CSS file
- Clerk middleware uses `createRouteMatcher` to define public routes, and `auth.protect()` redirects unauthenticated users automatically

### Next session

- [ ] Set up accounts: Clerk, Plaid (sandbox), Supabase
- [x] Copy `.env.example` to `.env.local` and fill in Clerk keys
- [x] Run `npm install` and `npm run dev` — verify the sign-in flow works end-to-end
- [x] Create the Supabase schema: `connected_accounts` + `cards` tables with RLS
- [x] Wire up Supabase client in `lib/supabase.ts`

---

## Session 2 — 2026-05-28

### What was built

- Plaid integration end-to-end:
  - `lib/plaid.ts` — Plaid API client (sandbox → dev → prod via single env var)
  - `/api/plaid/create-link-token` — server creates a link token, never exposing credentials to browser
  - `/api/plaid/exchange-token` — swaps public token for access token, saves connection + cards to Supabase
  - `/api/plaid/sync` — re-fetches balances on demand (to be hooked up to a cron later)
- `components/cards/ConnectCardButton.tsx` — client component that opens Plaid Link and handles the full OAuth-style flow
- Dashboard (`app/(dashboard)/dashboard/page.tsx`) — server component that reads cards from Supabase and renders balance, available credit, limit, and a color-coded utilization bar per card
- Fixed routing: moved dashboard page from `(dashboard)/page.tsx` to `(dashboard)/dashboard/page.tsx` so it correctly resolves to `/dashboard`

### Decisions made

| Decision | Reason |
|---|---|
| `Products.Auth` instead of `Products.Liabilities` | Liabilities product blocks non-supporting sandbox institutions; Auth is universal. Liabilities added back in Phase 2 for due dates/minimum payments |
| Credit-only filter in exchange-token | Only save `type === 'credit'` accounts — skip checking/savings. Works correctly with real banks in dev/prod |
| Service role key for all server writes | Simpler for MVP; RLS policies still in place for any future client-side access |
| Server component dashboard | Data fetching stays server-side; Supabase never called from the browser |

### What I learned

- Route groups `(name)` don't add URL segments — `(dashboard)/page.tsx` resolves to `/`, not `/dashboard`
- Plaid's public token is single-use and short-lived — must be exchanged server-side immediately for a permanent access token
- The access token must never leave the server — stored encrypted in Supabase, only read in API routes
- `window.location.reload()` on a Next.js server component page triggers a full re-render and re-fetch from Supabase
- Plaid sandbox test institutions mostly return depository accounts — credit card accounts require specific institutions or dev mode with real banks

### Next session

- [ ] Add a manual refresh button that calls `/api/plaid/sync`
- [ ] Due dates — decide: Plaid Liabilities product or manual input field?
- [ ] Quick pay links per card
- [ ] UI polish — card icons per institution, better empty state
- [ ] First commit and push to GitHub

---

---

## 2026-08-14 — Public surface, auth, mobile, docs

The biggest single session so far. Started as "add some Motion" and became a
rebuild of everything a signed-out visitor sees.

### Built

- **`DashboardView` extracted** from the dashboard page. It holds every pixel
  and does no data fetching; the real page passes Supabase rows in and the demo
  passes fixtures in. The old `DemoDashboard` lookalike and `DonutChart` are
  deleted. The demo can no longer drift from the app.
- **Public filmstrip** — `/demo ← / → /sign-in` as three always-mounted panels
  that slide. The nav never unmounts.
- **Landing rebuilt** — typewriter headline, animated card stack, migrated off
  the old slate palette.
- **Auth** — Google and Apple added on Clerk, form embedded as a panel, themed
  in CSS against Clerk's `cl-*` classes. Added `/sso-callback`.
- **Dark mode everywhere**, applied before first paint by a blocking script.
- **Phone layout** — tabs, and the document scrolls rather than an inner box.
- **"Pay before close" renamed** to "Lower reported utilization", with
  `77% → 30%` on each row.
- **Docs** — new `docs/ARCHITECTURE.md`, rewritten README, PRD updated.

### Decided

| Decision | Why |
|---|---|
| Keep Clerk, add social login | Vendor choice is independent of login methods; both do Google and Apple |
| Clerk → Supabase Auth deferred | Revisit *with* the RLS work, not separately — that's where it pays out |
| Production Clerk waits for a domain | Prod instances need DNS; they can't run against localhost |
| Phone gets a different layout, not a reflow | The desktop grid's fractions collapse at phone height |

### Learned

- A flex item that is a scroll container has `min-height: auto` resolve to 0 —
  so `overflow-clip` silently stops a page growing.
- Percentage heights need a definite parent; `min-h-dvh` doesn't give one.
- `--raised` is darker than `--ground` in light and lighter in dark, so surface
  pairings invert between themes.
- iOS only collapses its address bar for *document* scroll.
- Next dev compiles on demand, so parallel Playwright workers make it drop
  connections — two workers is stable and faster than five.

### Next session

- [ ] Move reads off the Supabase service-role key so RLS actually runs
- [ ] `npm audit` — pre-existing advisories, bumping Next clears most
- [ ] Background sync (Vercel cron) so data updates when the app isn't open
- [ ] Deploy: domain, production Clerk, Plaid production application

