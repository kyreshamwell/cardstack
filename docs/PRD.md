# Cardstack Product Requirements Document
**Version:** 1.1  
**Status:** Phase 1 built, not yet deployed  
**Owner:** Kyre  
**Last updated:** 2026-08-14  

---

## Problem

Managing multiple credit cards means checking 4 or 5 different apps just to know your balances, due dates, and available credit. There's no single clean view. The result is missed payments, forgotten balances, and a fragmented picture of where you stand financially. Existing tools like Rocket Money are bloated with features you don't need. This app does one thing well: it's your credit card command center.

---

## Users

**Primary user**  
Someone managing 2 to 5 credit cards who wants a single dashboard to monitor balances, track due dates, and understand their credit utilization without logging into multiple apps.

**Portfolio audience**  
Engineers and hiring managers in fintech (Cap One, JP Morgan, DTCC) who want to see real API integration, thoughtful data modeling, and production-level engineering practices.

---

## Scope

### Phase 1: MVP (Core dashboard), **built**
- [x] Auth (Clerk): email, plus Google and Apple
- [x] Connect cards via Plaid, or add them manually
- [x] Balance + available credit per card
- [x] Due dates + payment status
- [x] Quick link to pay each card
- [x] Credit utilization per card
- [x] Transactions and detected recurring charges
- [x] CSV import for cards Plaid can't reach
- [x] Public demo at `/demo`, the real dashboard on fixture data
- [x] Privacy mode, dark mode, phone layout

**Not done, and blocking real users:**
- [ ] Reads still use the Supabase service-role key, bypassing RLS
- [ ] Plaid is still in sandbox
- [ ] Clerk is still a development instance
- [ ] No background sync, so data only refreshes while the app is open

### Phase 2: Budgeting layer
- Spending by category. **The data is already stored on every transaction,
  this view was deferred and never built**
- Monthly spend by category
- Budget limits per category
- Savings goal calculator
- Bill total for the month

### Phase 3: AI layer
- Spending habit insights
- Budget recommendations
- Natural language math
- Goal planning assistant (Claude API)

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js (App Router) | Server components + API routes in one repo |
| Language | TypeScript | Type safety on financial data |
| Auth | Clerk | Best DX with Next.js, handles sessions cleanly |
| Financial API | Plaid | Industry standard, sandbox → dev → prod path |
| Database | Supabase | Postgres + RLS for secure user data |
| Styling | Tailwind CSS | Fast iteration, consistent design tokens |
| Deployment | Vercel | Zero config, preview deployments per PR |
| Testing | Vitest + Playwright | Unit, integration, and E2E coverage |
| AI (Phase 3) | Claude API | Budget analysis + natural language insights |

---

## Engineering Standards

### Test coverage
Unit tests for utility functions (date formatting, balance math, utilization calc). Integration tests for Plaid sync and Supabase writes. E2E for the core user flow (connect card → view dashboard).

### Git workflow
Feature branches off main. PRs with a short description of what changed and why. Conventional commits (`feat:`, `fix:`, `chore:`). Tags for version releases.

### Documentation
- `README.md` covers setup, env vars, scripts, and Plaid sandbox
- `docs/ARCHITECTURE.md` covers how the app fits together and why, including
  approaches that were tried and abandoned
- Architecture decisions recorded in `/docs/decisions/`
- `DEVLOG.md` logs what was built and decided each session
- Every source file carries a header comment explaining its job. Those are the
  primary documentation; the docs above are the map

### Security
Plaid access tokens stored encrypted in Supabase, never exposed to the client. RLS policies so users only ever see their own data. All sensitive operations run server-side.

---

## Constraints

| Constraint | Detail |
|---|---|
| Monetization | None. Portfolio demonstration, always free |
| Plaid environment | Sandbox first, then development mode for real accounts |
| Supabase uptime | Cron ping to prevent inactivity pause on free tier |
| Scope creep | No investment tracking, no bank account aggregation in MVP |
| Timeline | MVP built; deployment pending (originally targeted July 2026) |

---

## Success Metrics

- [ ] Card dashboard live and deployed on Vercel
- [x] Core user flows covered with tests end-to-end
- [ ] Case study written for portfolio
- [x] Can walk through every architectural decision in an interview

---

*This PRD is a living document. Update it as scope evolves.*
