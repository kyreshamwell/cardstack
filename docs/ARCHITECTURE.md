# Architecture

How Cardstack is put together, and **why** — including the approaches that were
tried and abandoned, so they don't get proposed again.

If you're changing the public pages, the dashboard layout, or auth, read the
relevant section here first. Several things in this codebase look arbitrary and
are not.

---

## The shape of the app

Three surfaces, one set of components:

| Surface | Route | Auth | What it is |
|---|---|---|---|
| Landing | `/` | public | The pitch |
| Demo | `/demo` | public | The **real dashboard** on fixture data |
| Auth | `/sign-in`, `/sign-up` | public | Clerk, embedded |
| Dashboard | `/dashboard` | protected | The real dashboard on Supabase data |

`middleware.ts` is the gate: everything not explicitly listed as public is
protected before any server component runs, so there's no path where a page
renders and *then* discovers it shouldn't have.

---

## One dashboard, two data sources

`components/dashboard/DashboardView.tsx` holds every pixel of the dashboard and
does **no data fetching**.

- `app/(dashboard)/dashboard/page.tsx` queries Supabase and passes rows in.
- `components/demo/DemoDashboard.tsx` passes fixtures in.

This is the single most important structural decision in the project. The demo
used to be a separate lookalike component, and it drifted badly — it sat on the
old slate palette for months after the redesign and showed a layout the app no
longer had. A demo assembled from the real components can only be wrong if the
app is wrong too.

It also buys the widest test coverage available: `/demo` renders the real
dashboard **with no credentials**, so Playwright can assert against it without a
seeded account.

**The seams are `ReactNode` props.** Anything needing a network — the toolbar,
per-card actions, the limit editor — is injected rather than imported, because
those are exactly the things the demo has to replace. In the demo they're
replaced by `GatedButton`, which raises one shared "needs a real account"
prompt.

`explain` is the other prop that differs: the demo shows short teaching lines
under section labels, the real dashboard doesn't. The demo has readers who've
never seen the product; your own dashboard doesn't, and an explainer you can't
dismiss is clutter.

---

## The public filmstrip

`components/landing/MarketingFrame.tsx` renders all three public panels as one
horizontal strip, in the `(marketing)` layout:

```
[ demo ] ← [ landing ] → [ sign in / sign up ]
```

Navigating translates the strip by exactly one viewport with a spring. The
`AppShell` around it — nav, brand, frame — never unmounts, so nothing reloads.

**All three panels stay mounted at all times.** That's load-bearing, and it's
the thing most likely to trip you up: `getByRole('heading')` matches more than
one element, `[data-card-id]` finds the demo's rows from the landing page. Use
the `data-panel` / `data-active` attributes to tell which is on screen.

### Four approaches that failed

Recorded because each looked correct until it wasn't:

1. **Local state + `history.pushState`.** The App Router remounts the route tree
   when the URL is pushed underneath it, so the view reset every time — address
   bar on `/demo`, hero still on screen.
2. **`AnimatePresence mode="wait"` cross-fade.** Correct, but reads as lag:
   0.28s out, a dead beat, 0.28s in, with nothing moving for most of it.
3. **`AnimatePresence mode="sync"` slide.** In a Next *layout* the exiting child
   can't keep the old page's `children` — that prop has already been replaced —
   so the panel sliding out re-rendered as the incoming one and two dashboards
   crossed the screen. The usual fix freezes an internal Next router context:
   a lot of fragility for one transition.
4. **A drawer** that squeezed the landing page to 46% while auth opened beside
   it. It worked, but signing in reads as a destination rather than something
   opened next to the pitch.

Mounting all three removes the entire class of problem: no enter, no exit, no
unmount to coordinate — just one transform. It also means the demo is built and
painted before it's ever asked for, so the slide has nothing to compile
mid-flight.

The cost: the routes' `children` go unused. The layout owns the panels; the
pages exist to own the URL, the metadata, and the signed-in redirect.

---

## Auth

Clerk, with Google and Apple enabled as social connections.

**`routing="virtual"`, not `"path"`.** Path routing makes Clerk assert it's
mounted on a catch-all route matching its own `path`, and this form is mounted
the whole time — including while the URL is `/`. That threw on every page load.
Virtual routing is Clerk's mode for embedded forms: multi-step state lives in
memory rather than in the URL.

The trade is that OAuth has no Clerk-owned path to return to, hence
**`app/sso-callback/page.tsx`**. It must stay public in middleware: when the
browser lands there the session doesn't exist yet, so protecting it would bounce
to `/sign-in` and throw away the OAuth response in the URL.

**Clerk is themed in `globals.css` against its stable `cl-*` classes**, not the
`appearance` prop. The root layout used to set a global `appearance` on the old
slate palette, and it silently beat anything passed per-component. CSS also
follows dark mode, which `appearance.variables` (fixed hex values) cannot.

Clerk quirks handled there, each of which cost time to find:

- Two localization keys for provider labels — `socialButtonsBlockButton` **and**
  `socialButtonsBlockButtonManyInView`. Only the first has the "Continue with…"
  phrasing by default, so enabling a second provider collapses both to bare
  names.
- Clerk's boxes carry an intrinsic **minimum width** and won't shrink; releasing
  `min-width` matters as much as setting `width`.
- Its inputs draw their outline as a `box-shadow` ring, which stacks with a real
  CSS border and reads as a pale halo.
- The placeholder colour is hardcoded and ignores the theme.
- `.cl-cardBox` sets `overflow: hidden`, which clips the "Last used" badge.
- Provider marks are `<img>` from Clerk's CDN, so they can't inherit
  `currentColor` — Apple's black glyph is invisible on a dark button and is
  inverted in dark mode only.

**Identity model.** Every table keys off `user_id text` — the Clerk user ID.
Data belongs to a user ID, not to an email and not to a login method. Google,
Apple and password are three doors into the same user record, joined by Clerk's
verified-email linking. The known failure: Apple's *Hide My Email* supplies a
relay address that can't match, which creates a second, empty account.

---

## Layout: fixed viewport on desktop, document scroll on phones

The desktop promise is that the dashboard fits one screen: `h-dvh`,
`overflow-hidden`, and each region scrolling internally via `.scroll-y`.

That model does not survive a phone. Measured on a 375×812 viewport before the
rewrite: four nested scrollers, one **0px tall** and another **37px holding
998px of content**, with labels overlapping the rows beneath them.

Below `xl` the dashboard is therefore a **different layout, not the same one
reflowed**: tabs (Cards / Activity / Insights), with the balance kept outside
the tabs, and the **document** scrolling rather than any inner box.

### Traps, all of which cost real time

- **Nested scrollers eat touch gestures.** `.scroll-y` sets
  `overscroll-behavior: contain`, which makes it worse. `.flow-scroll`
  neutralises them inside the phone layout — including their `-mx-1 px-1`, which
  exists so a scrollbar can hang outside the content and otherwise pushes every
  row 4px past the panel edge.
- **iOS only collapses its address bar for *document* scroll.** A full-height
  inner scroller looks identical and still feels wrong.
- **`overflow-clip` makes an element a scroll container**, and a flex item that
  is a scroll container has `min-height: auto` resolve to 0 — so it clips tall
  content instead of growing, and the page silently stops scrolling. Clip
  horizontally only.
- **Percentage heights need a definite parent.** Once the shell is `min-h-dvh`
  rather than `h-dvh`, `h-full` / `min-h-full` / `max-h-full` resolve to
  nothing. Use a flex chain (`main` → container → track → panel) instead. This
  one caused three separate visual bugs before it was understood.
- **A percentage `max-height` can't cap an auto-height sibling**, so off-screen
  panels are `hidden` below `xl` rather than height-capped — otherwise the
  off-screen dashboard gives the landing page a screenful of empty scroll.
- **The filmstrip is desktop-only.** With one panel in flow, translating -100%
  per index pushes it off screen, so `.filmstrip-track` gets
  `transform: none !important` under a media query.

---

## Theming

Semantic tokens in `globals.css` (`--ground`, `--raised`, `--ink`, `--line`,
`--s1…--s6`), redefined under `.dark` and mapped to Tailwind utilities via
`@theme inline`.

**`--ground` and `--raised` do not hold a fixed relationship.** `raised` is
*darker* than `ground` in light (#fafafa on #ffffff) and *lighter* in dark
(#0e0e0e on #000000). So "controls on `ground`, card on `raised`" reads as
elevated in light and sunken in dark. Put controls on `raised` over a `ground`
surface — that means elevated in both.

Dark mode follows the device by default and is applied by a **blocking script in
`<head>`** before first paint. Applying it in an effect gives dark-mode devices a
white flash on every load.

The six `--s*` colours are validated for colour-vision-deficiency separation in
both themes, and a swatch never carries meaning alone — every one is rendered
beside the card's name.

---

## Privacy mode

A single CSS rule: `.privacy-mode .sensitive-value { filter: blur(8px) }`. That
makes it **opt-in per element**, which makes it exactly the kind of feature that
rots — a new component renders a figure, nobody adds the class, and the leak is
invisible because everything looks right with privacy mode off.

It has already happened twice (the pie chart, and the CSV import preview).
`tests/components/privacy.test.tsx` sweeps rendered output for anything matching
a currency or percentage pattern that isn't inside a `.sensitive-value`. **Add
new money-showing components to its `CASES` list.**

---

## Security

`docs/schema.sql` already carries correct RLS policies:

```sql
using (user_id = auth.jwt() ->> 'sub')
```

`auth.jwt() ->> 'sub'` means: return this row only if its `user_id` matches the
`sub` ("subject") claim of the token the request arrived with. Clerk's user ID
is what's stored in that column, so the policies are already written correctly.

**They have historically never run.** Postgres exempts the `service_role` from
RLS by design, and every route used `supabaseAdmin` — which is built from the
service-role key. So isolation rested on all 25 queries remembering
`.eq('user_id', …)`. Correct today; the risk is the 26th.

### The migration, in progress

`lib/supabase.ts` now also exports **`supabaseForUser()`** — the anon key plus
the caller's Clerk session token, so Postgres actually evaluates the policies.

This relies on Clerk's **native Supabase integration**: Supabase is configured
to trust Clerk's domain as a third-party auth provider, and `getToken()` is
called with no template argument. The older JWT-template approach was
deprecated in April 2025; nothing here shares a Supabase JWT secret with Clerk.

`app/api/viewed/route.ts` is migrated as the pilot — the smallest read/write
pair, so a misconfiguration fails there rather than somewhere expensive. Its
`.eq('user_id', …)` filters are now belt and braces rather than the security
boundary.

**Remaining:** the other 13 files using `supabaseAdmin`. Move reads first, then
writes. Anything genuinely without a user session — a cron sync — may keep
`supabaseAdmin`, but should say why at the call site.

Note this also settles the Clerk-vs-Supabase-Auth question in Clerk's favour:
the native integration closes almost all of the gap that previously argued for
switching.

---

## Testing

| Layer | Tool | Where |
|---|---|---|
| Pure logic, API routes | Vitest (node) | `tests/**/*.test.ts` |
| Components | Vitest + Testing Library (jsdom) | `tests/components/*.test.tsx` |
| Browser | Playwright | `e2e/` |

Conventions worth keeping:

- **Mutation-test anything important.** Break the code deliberately and confirm
  exactly the intended test fails. Several assertions in this repo were written
  that way and the technique has caught vacuous tests.
- **Scope E2E assertions to the active panel.** All three public panels are
  always mounted; counting elements proves nothing about what a visitor sees.
- **Two Playwright workers, not the CPU count.** The Next *dev* server compiles
  on demand and drops connections under more load — tests that pass alone and
  fail in the pack. Two is stable *and* faster (~20s vs ~52s).
- `e2e/global-setup.ts` warms the routes serially before the workers fan out, so
  no single test pays for a cold compile.
- `e2e/dashboard.spec.ts` is skipped until `E2E_CLERK_USER_EMAIL` /
  `E2E_CLERK_USER_PASSWORD` exist. Point them at a **seeded throwaway** Supabase
  project — one of those tests deletes a card.

---

## Things that look like bugs and aren't

- **`app/(marketing)/*/page.tsx` render `null`.** The panels live in the layout;
  the pages own the URL, metadata and redirect.
- **`BalancePie` resolves clicks through hover**, with a fallback that resolves
  the row from the event target. Without the fallback the chart is dead to touch
  entirely, because a tap produces no hover.
- **`CardFocusManager` applies its filter in an effect**, not in the event
  handler. On the phone layout the rows don't exist in the DOM when the event
  fires — they're on another tab.
- **The demo's "Pay this card" is an inert `<span>`.** The real one is an `<a>`
  to the bank; sending a sample visitor to chase.com from a fake Chase card
  isn't ours to do.
