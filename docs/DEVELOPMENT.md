# Development

Guide for changing this codebase safely.

## 1. Local setup from zero

```bash
git clone <repo-url>
cd Fgrapher
pnpm install                 # also runs `prisma generate` via postinstall
cp .env.example .env         # Prisma CLI (generate/migrate) only reads .env
cp .env.example .env.local   # Next.js runtime reads .env.local
```

Fill in `.env` and `.env.local` (both need `DATABASE_URL`/`DIRECT_URL`
duplicated — see the root `CLAUDE.md`'s Environment section for exactly
why). At minimum for a working dev environment you need:

- `DATABASE_URL` / `DIRECT_URL` — a Supabase Postgres project (see
  `docs/OPERATIONS.md` §5 before ever pointing these at anything but a
  personal/dev project — `scripts/check-db-safety.mjs` will refuse
  `db:push`/`db:reset` against anything not on its explicit allow-list).
- `NEXTAUTH_SECRET` — any random 32+ char string (`openssl rand -base64 32`).
- `NEXTAUTH_URL="http://localhost:3000"`.

Everything else (Google OAuth, Cloudinary, Stripe, Resend) is optional for
local dev — every integration no-ops gracefully without its credentials
(see `docs/ARCHITECTURE.md` §7).

```bash
pnpm db:migrate:dev    # applies every migration in prisma/migrations/
pnpm db:seed       # creates the seed accounts below
pnpm dev           # http://localhost:3000
```

Seed accounts (password `Test1234!` for all): `photographer@test.com`,
`videographer@test.com`, `makeup@test.com`, `studio@test.com`,
`shop@test.com`, `model@test.com`, `customer@test.com`, `admin@test.com`
(exercises `/admin`), `multi@test.com` (Photographer + Videographer, for
testing multi-role behavior).

**Three most common setup failures:**

1. **`DATABASE_URL` works for `prisma migrate` but the app can't connect
   at runtime, or vice versa.** This almost always means `.env` and
   `.env.local` have gone out of sync — the Prisma CLI only reads `.env`;
   Next.js only reads `.env.local`. Keep both files' `DATABASE_URL`/
   `DIRECT_URL` identical.
2. **`prisma migrate dev`/`db:push` refuses to run** with a "not a
   known-safe database" error — `scripts/check-db-safety.mjs` is doing
   its job; you're pointed at a database ref it doesn't recognize. Don't
   bypass it; either point at the intended dev database or deliberately
   add the ref to `SAFE_DB_REFS` if you're sure.
3. **Login redirects back to `/login?error=CredentialsSignin`** after
   seeding — check that `NEXTAUTH_URL` matches the URL you're actually
   visiting (`http://localhost:3000`, not `127.0.0.1:3000` — NextAuth's
   cookie handling is sensitive to this) and that `NEXTAUTH_SECRET` is set.

## 2. Development workflow

- **Branch naming:** not enforced by tooling; `type/short-description`
  (e.g. `feat/model-role`) matches the commit convention below.
- **Commit format:** `type(scope): description` (root `CLAUDE.md`'s
  rule) — e.g. `feat(auth): add Google OAuth provider`,
  `fix(browse): stop rapid filter clicks from clobbering each other`.
- **Testing locally before pushing:** `pnpm lint`, `npx tsc --noEmit`,
  `pnpm build` — all three should be clean. Run relevant Playwright specs
  if you touched a flow they cover (§4).
- **Preview deploys:** every branch/PR gets a Vercel Preview deployment
  against the shared `fgrapher-dev` Supabase database (see root
  `CLAUDE.md`'s Database environments table) — the same database local
  dev uses, so preview data can look "dirty" from other people's local
  testing; that's an accepted tradeoff at this scale, not a bug.
- **What must pass before merging:** lint + typecheck + build clean;
  CI's Playwright `e2e` project (`.github/workflows/test.yml`) green
  against the branch's own disposable Postgres; visual regression
  (`visual-light`/`visual-dark`) has no unexpected diffs.

## 3. Common tasks

### Adding a new page

1. Create `src/app/(group)/your-route/page.tsx` (pick the route group by
   audience — see `docs/ARCHITECTURE.md` §3's folder table).
2. Server Component by default; fetch data via a `services/*` function
   directly, not your own API route.
3. Add `export const metadata` (or `generateMetadata` if it depends on
   route params) for SEO.
4. If it needs a nav entry, update `web-nav.tsx` (public) or
   `dashboard-sidebar.tsx` (dashboard) or `admin-sidebar.tsx` (admin).
5. If it should be locale-aware, add strings to both
   `src/messages/en.json` and `vi.json` and use `useTranslations()` —
   but note most of the dashboard/settings/browse UI today is
   intentionally hardcoded English (see `docs/ARCHITECTURE.md`'s
   conventions section); match whichever pattern the surrounding page
   already uses rather than mixing the two within one page.

### Adding a new API route

1. Create `src/app/api/your-resource/route.ts`, exporting `GET`/`POST`/
   etc.
2. `requireAuth()` (or `requireRole`/`requireActiveSubscription`/
   `requireAdmin`) at the top, inside a `try`.
3. Validate the body with a Zod schema from `lib/validations/` (add one
   if it doesn't exist yet).
4. Call a `services/*` function for the actual logic — never inline
   Prisma calls in the route handler.
5. Return `{ data, error, message }` with the right HTTP status (see
   `docs/ARCHITECTURE.md` §9 for the exact convention); catch
   `AuthError` first, then any domain-specific error class, then a
   generic 500.

### Adding a field to an existing model

1. Add the field to `prisma/schema.prisma`.
2. `npx prisma migrate dev --name descriptive_name` (creates + applies
   the migration, regenerates the client).
3. **Restart your local dev server.** `next dev` does not pick up a
   regenerated `@prisma/client` on its own — this bit us during Model's
   own implementation (a stale client caused a real
   `PrismaClientValidationError`/500 on the profile page right after
   adding the `MODEL` enum value, fixed only by restarting `pnpm dev`).
4. Update whatever Zod schema validates writes to that model
   (`lib/validations/*`).
5. If the field feeds a `Record<Role, X>` or similar exhaustive mapping
   anywhere, `tsc --noEmit` will list every spot that needs updating —
   don't grep manually, the compiler already knows.
6. Update `prisma/seed.ts` if the field is worth exercising in seed data.

### Adding a new role

Reference: this is exactly what adding MODEL did (`docs/guides/
fgrapher-prompts-batch-2.md` §3a). Full checklist lives in
`.claude/skills/role-permissions/SKILL.md` — follow it verbatim, it's kept
in sync with what actually broke and needed fixing last time.

### Adding a new email template

1. Add an HTML-string function to `src/lib/email.ts`, matching the
   existing `bookingEmailShell()`-wrapped pattern (not a new templating
   dependency — see that file's comment on why).
2. Call `sendEmail({ to, subject, html })` from the relevant `services/*`
   function, typically alongside a `notify()`/`notifyCritical()` call.
3. If it should respect user notification preferences, add a
   `PREFERENCE_KEY` mapping entry in `services/notification.ts`; if it's
   an account-critical email (billing, security), use `notifyCritical()`
   instead, which always sends regardless of preferences.

### Adding a new notification type

1. Add the value to the `NotificationType` enum in `prisma/schema.prisma`
   and migrate.
2. Call `notify()` (or `notifyCritical()`) with the new `type` from the
   relevant `services/*` function.
3. If it needs its own user-facing preference toggle, add a key to
   `NOTIFICATION_KEYS` in `lib/validations/user.ts` and map it in
   `services/notification.ts`'s `PREFERENCE_KEY`.

### Adding a translation string

1. Add the key to `src/messages/en.json`.
2. Add the same key to `src/messages/vi.json` with a real translation —
   don't leave it as an English placeholder, next-intl won't warn you if
   you do.
3. Use `useTranslations("namespace")` (client) or
   `getTranslations()` (server) — see `hero-search.tsx` / `page.tsx` for
   examples of each.

## 4. Testing

- **Unit/component tests:** none exist. Root `CLAUDE.md` documents
  `pnpm test # vitest`, but there's no Vitest dependency or `test` script
  in `package.json` — this is stale documentation, not a hidden feature;
  see the technical debt register below.
- **E2E (Playwright):** `e2e/*.spec.ts`, full setup in `e2e/README.md`.
  Short version: spin up a disposable local Postgres, `cp
e2e/.env.test.example e2e/.env.test`, `pnpm test:e2e` — this resets and
  seeds that database on every run (never point it at dev/prod).
  `pnpm test:e2e:ui` for Playwright's interactive debugger.
- **Writing a new E2E test:** follow the pattern in an existing spec
  (`e2e/booking-review.spec.ts` is a good mid-complexity example) —
  `e2e/helpers/auth.ts` for logging in as a seeded persona,
  `e2e/helpers/db.ts` for direct-Prisma setup/bridging where a real
  third-party integration isn't configured (see the next point).
- **What must have coverage:** nothing is formally mandated, but every
  spec file maps to one feature area (auth, booking+review, marketplace,
  messaging, subscription lifecycle, provider onboarding, password
  reset) — a new feature area should get its own spec.
- **Testing payment flows safely:** never use real Stripe keys in `e2e/
.env.test` or local dev unless you mean to. Without `STRIPE_SECRET_KEY`
  set, every Stripe call no-ops via `StripeNotConfiguredError`/
  `isStripeConfigured()` — the E2E suite is written to work with this
  (see `e2e/README.md`'s "Known gaps" section), asserting the app's own
  graceful degradation message and then bridging the rest of the flow
  directly via Prisma, standing in for what the webhook would have done.
  If you need to test a real Stripe round-trip, use Stripe **test mode**
  keys plus `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  — never live keys in development.
- **Visual regression:** `pnpm test:visual` — baselines are OS-specific
  (CI runs Linux; a Mac-generated baseline never matches CI). See `e2e/
README.md`'s "Visual regression" section for the actual baseline
  bootstrap procedure (a manually-triggered CI job, not a local command).

## 5. Database changes

- **Migration workflow:** `npx prisma migrate dev --name descriptive_name`
  locally against dev → verify on a Preview deployment (shares the dev
  database) → `prisma migrate deploy` against production, manually, only
  once the above two steps are clean. Never skip straight to production
  (root `CLAUDE.md`'s explicit rule).
- **Writing a safe migration:** additive changes (new optional column,
  new enum value, new table) are always safe. A `NOT NULL` column on an
  existing table needs a default or a backfill step — Prisma will refuse
  to generate a migration that would fail against existing data;
  don't work around that refusal by hand-editing the generated SQL
  without understanding why it refused.
- **Destructive changes** (dropping a column/table, renaming — Prisma
  represents a rename as drop+add unless you edit the migration SQL by
  hand to use `ALTER ... RENAME`): back up first (`docs/OPERATIONS.md`
  §5), and prefer a two-step deploy (stop reading/writing the old
  column in application code first, deploy, confirm nothing broke,
  _then_ drop it in a follow-up migration) over a single migration that
  breaks compatibility with whatever's still running during the deploy
  window.
- **Testing a migration against a copy of production data:** no tooling
  exists for this today (no anonymized-prod-snapshot pipeline). The
  closest available option is a Supabase branch/point-in-time-recovery
  restore into a scratch project, migrate that, and diff manually — this
  is a real gap worth building before this matters for a production
  database with real user data in it.

## 6. Debugging guide

- **Tracing a problem in the Next.js layer:** Server Component
  errors/exceptions show in the terminal running `pnpm dev`; Client
  Component errors show in the browser console plus the terminal (RSC
  error digest). Middleware (`src/proxy.ts`) logs only show in the
  terminal, never the browser.
- **Prisma logging:** the client at `src/lib/db.ts` doesn't currently
  enable query logging. Add `log: ["query", "error", "warn"]` to the
  `new PrismaClient({...})` call temporarily when you need to see actual
  SQL — remember to revert it, this is noisy in normal operation.
- **Inspecting a Stripe event:** `stripe listen --forward-to
localhost:3000/api/webhooks/stripe` for live forwarding during local
  dev, or `stripe trigger <event-name>` to fire a synthetic one. The
  Stripe Dashboard's Developers → Events log shows the exact payload for
  anything that already fired, live or test mode. `WebhookEvent` rows in
  the database (`id` = Stripe event ID) tell you whether this app
  actually processed a given event, and its `error` column if
  processing failed.
- **Reading Vercel function logs:** Vercel dashboard → your project →
  Logs (or `vercel logs <deployment-url>`) — this is the only visibility
  into a deployed environment's Server Component/API route errors until
  Sentry is wired up (see `docs/OPERATIONS.md` §7).
- **The dev-server-needs-a-restart trap:** if you change
  `prisma/schema.prisma` and run a migration, and then start seeing
  `PrismaClientValidationError`/type-mismatch errors that make no sense
  given the schema, restart `pnpm dev` before doing anything else — see
  the callout in §3's "Adding a field" recipe above. This cost real
  debugging time during Model's implementation.

## 7. Performance

No performance baseline exists — this app has never carried real
production traffic (see root `CLAUDE.md`'s "Current phase": Phase 12's
deployment steps haven't happened). There are no current numbers to
report, and it would be dishonest to invent them.

**Known, code-confirmed sources of latency** worth keeping in mind:

- Every Supabase Postgres query goes over the network to a real remote
  pooler — round trips of ~1-2.5 seconds were repeatedly observed during
  this project's own development for ordinary reads/writes (e.g., a
  single `/browse` filter click's RSC round-trip measured at ~1.15
  seconds — see `src/components/browse/filter-sidebar.tsx`'s handling of
  exactly this). Any new feature that fires several sequential DB round
  trips per interaction will feel slow in this same way; batch queries
  with `Promise.all` where they don't depend on each other (see
  `services/search.ts` for the existing pattern).
- No caching layer exists (`docs/ARCHITECTURE.md` §7 — Redis/Upstash was
  explicitly skipped). Every `/browse` request re-queries from scratch.
- Messaging/notifications are polling-based (4s/15s/30s intervals, see
  `docs/ARCHITECTURE.md` §7), not push — this is a deliberate,
  documented tradeoff, not something to "fix" without deciding to invest
  in a real transport layer.

## 8. Technical debt register

Ranked roughly by how much it should worry you.

1. **Published profiles never actually appear in search — this is not
   theoretical, it's confirmed by reading every call site.** `grep
isPublished` across `src/` shows it's read everywhere search/sitemap/
   the public profile page check it, but **written exactly once** in the
   whole codebase: `services/subscription.ts`'s `handleSubscriptionDeleted`
   sets it to `false` on cancellation. Nothing ever sets it `true` — not
   the profile editor (`updateProfileSchema` doesn't even include the
   field), not subscription activation, nothing. A provider can complete
   registration, pay for a subscription, and fully fill out their
   profile through the real UI, and it will never show up in `/browse`
   or the sitemap. (This was independently discovered and documented in
   `e2e/README.md`'s "Known gaps" section by whoever built the E2E
   suite, and confirmed again here by directly grepping every write
   site — two independent findings agreeing is a strong signal this is
   real, not a misunderstanding.) **Where:** needs either a "Publish
   profile" toggle in the profile editor UI, or auto-publish on first
   successful subscription activation (`services/subscription.ts`'s
   `syncSubscriptionFromStripe`/`handleCheckoutCompleted`) — a product
   decision, not just an engineering one. **Effort:** small once the
   decision is made — one field addition to a schema and one write site.
2. **`User.isSuspended` is not enforced anywhere.** `services/admin.ts`
   sets it; the admin UI displays it; nothing in `auth.ts`'s `signIn`
   callback, `requireAuth()`, or `proxy.ts` ever checks it. A suspended
   user can keep using the app normally. **Where:** add a check in
   `auth.ts`'s `signIn` callback (blocks new sign-ins) and consider
   whether existing sessions should be invalidated too (JWT sessions
   don't have a server-side revocation list today — see the next item).
   **Effort:** small for the sign-in check; larger if session
   invalidation is also required.
3. **No session revocation.** Sessions are JWT-based
   (`session: {strategy: "jwt"}` in `auth.ts`) with no server-side store
   — there's no way to force-invalidate an existing session (e.g., after
   a suspension, a password change, or a suspected compromise) short of
   rotating `NEXTAUTH_SECRET`, which would log out every user at once.
   **Effort:** meaningful — likely means moving to database sessions for
   at least the cases that need revocability, or adding a
   suspended-check that runs per-request regardless of JWT validity.
4. **No rate limiting anywhere.** Every API route is gated by auth, not
   request volume. Login, registration, password reset, and report
   submission are all realistic abuse targets with nothing in front of
   them. **Effort:** medium — needs a rate-limit store (Redis/Upstash,
   currently absent per `docs/ARCHITECTURE.md` §7) or an edge-level
   solution.
5. **Booking cancellation has no minimum-notice rule**, unlike booking
   _creation_, which requires 24 hours (`docs/FEATURES.md`'s business
   rules appendix). Either party can cancel a `PENDING`/`CONFIRMED`
   booking at any time, including minutes before it starts. Confirm
   whether this is intentional.
6. **The "who can book whom" role matrix is documentation, not
   enforcement.** `.claude/skills/role-permissions/SKILL.md` describes
   the intended table; `createBooking()` doesn't check it — any
   authenticated user can technically book any other user via a direct
   API call, restricted in practice only by which "Book" buttons the UI
   happens to render. Low risk today (nothing sensitive hinges on it)
   but worth closing if the role matrix ever needs to be a real
   guarantee rather than a UI convention.
7. **No Vitest/unit test runner**, despite root `CLAUDE.md` documenting
   `pnpm test`. Either add Vitest for the service-layer business logic
   (booking overlap detection, availability slot computation, age-range
   bucketing — all currently only covered indirectly by E2E specs) or
   correct the documented command.
8. **`@supabase/supabase-js`/`@supabase/ssr` are installed but unused.**
   Confirmed via `docs/ARCHITECTURE.md` §2's dependency audit — no
   current import anywhere. Either use them or note explicitly that
   they're reserved for a specific future feature so a future cleanup
   pass doesn't remove them thinking they're dead weight.
9. **Stripe Connect was never implemented** — marketplace payments settle
   to the single platform Stripe account, not split per-shop. The data
   model (`Order.shopId`, one Order per shop even from a multi-shop
   cart) is already shaped correctly for Connect; it's specifically the
   payout-splitting integration that's missing. Matters once real shops
   expect to be paid out directly.
10. **No production-data migration testing pipeline** (§5 above) — a
    real gap once there's real user data to be careful with.

## 9. Roadmap parking lot

Features discussed or implied but not built, with enough context to pick
up later:

- **Real-time messaging/notifications via Socket.io** — the stack was
  chosen for this (root `CLAUDE.md`'s stack list), but Phase 8 shipped
  polling instead as a deliberate interim choice (4s/15s/30s intervals —
  see `docs/ARCHITECTURE.md` §7). Swapping in real delivery later means
  adding a transport layer alongside the existing poll-based components,
  not rewriting their call sites — `notify()` in
  `services/notification.ts` is the natural place to also push a
  real-time event once a transport exists.
- **Stripe Connect** (per item 9 above) — needed before shops can be
  paid out directly rather than through manual reconciliation
  (`docs/OPERATIONS.md` §4).
- **ID verification enforcement level for the Model role** — the data
  model and admin queue exist (`/admin/verifications`,
  `UserRole.verificationStatus`); the user-facing ID upload flow was
  deliberately left unbuilt pending a decision on whether to require it
  at launch or start with a lighter check (`docs/guides/
fgrapher-prompts-batch-2.md` §3b item 2). Revisit before Model profiles
  are treated as fully safety-vetted.
- **Deposit-before-contact-details for Model bookings** — schema support
  exists (`Profile.requireDepositBeforeContact`, `Booking.depositPaid`),
  but `depositPaid` is a manual flag with no real payment flow behind it
  (bookings don't collect payment at all today — only subscriptions and
  marketplace orders do). Building this for real means extending Stripe
  into the booking flow, which doesn't exist yet.
- **Account suspension enforcement and session revocation** — see
  technical debt items 2-3.
- **Rate limiting** — see technical debt item 4.
- **Sentry + uptime monitoring** — Phase 12 Step 8, not started
  (`docs/OPERATIONS.md` §7).
- **Vitest / unit tests for service-layer logic** — see technical debt
  item 7.
