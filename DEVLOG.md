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
- [ ] Create the Supabase schema: `accounts` table (connected cards) and `users` table
- [ ] Wire up Supabase client in `lib/supabase.ts`

---
