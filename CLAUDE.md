# Fgrapher

Social-media-style booking & marketplace platform for the photography/videography industry.

## Stack

- **Framework:** Next.js 14+ (App Router, `src/` directory)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL hosted on Supabase, managed via Prisma ORM (`DATABASE_URL` = pooled connection, `DIRECT_URL` = direct connection for migrations)
- **Auth:** NextAuth.js v5 (credentials + OAuth), backed by the Supabase Postgres database via the Prisma adapter
- **Supabase client:** `@supabase/supabase-js` + `@supabase/ssr` are installed for any Supabase-specific features (storage, realtime) used outside of Prisma's ORM layer
- **Styling:** Tailwind CSS + shadcn/ui, `next-themes` for dark mode
- **i18n:** `next-intl`, EN/VI, cookie-based (no `[locale]` URL segment — see `src/i18n/`)
- **Storage:** Cloudinary (images/videos)
- **Payments:** Stripe (subscriptions + Connect)
- **Real-time:** Socket.io (messaging)
- **Deploy:** Vercel

## Architecture

### Folder structure

```
src/
  app/
    (auth)/           # login, register, forgot-password
    (dashboard)/      # role-based dashboard, settings, billing
    (public)/         # public profiles, search, explore, feed
    api/              # API route handlers
      auth/
      users/
      profiles/
      bookings/
      products/
      messages/
      webhooks/
    layout.tsx
    page.tsx
  components/
    ui/               # shadcn/ui primitives (Button, Card, Dialog...)
    layout/           # Header, Footer, Sidebar, MobileNav, WebNav
    brand/            # LogoMark, LogoFull
    sections/         # page-section components (HeroSearch, ...)
    forms/            # reusable form components
    cards/            # ProfileCard, ArtistCard, PostCard, ProductCard, BookingCard
    modals/           # booking modal, upload modal, confirm modal
  lib/
    db.ts             # Prisma client singleton
    auth.ts           # NextAuth config
    stripe.ts         # Stripe client + helpers
    cloudinary.ts     # upload helpers
    utils.ts          # general utilities
    constants.ts      # app-wide constants, enums
    validations/      # Zod schemas per domain
  i18n/               # next-intl routing/request config + locale server action
  messages/           # en.json / vi.json translation catalogs
  hooks/              # custom React hooks
  types/              # shared TypeScript types/interfaces
  services/           # server-side business logic (booking, payment, search)
  proxy.ts            # locale-detection middleware (Next.js 16 "proxy" convention)
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  design-reference/   # Claude Design export + extracted design-tokens.md
  guides/             # phase-by-phase build guides (source of the current plan)
```

### User roles (critical domain concept)

One user can hold MULTIPLE roles simultaneously. Roles determine UI visibility, permissions, and billing:

| Role          | Paid          | Can upload | Can sell/book        | Profile type            |
| ------------- | ------------- | ---------- | -------------------- | ----------------------- |
| PHOTOGRAPHER  | Yes (monthly) | Yes        | Receives bookings    | Portfolio + services    |
| VIDEOGRAPHER  | Yes (monthly) | Yes        | Receives bookings    | Portfolio + services    |
| MAKEUP_ARTIST | Yes (monthly) | Yes        | Receives bookings    | Portfolio + services    |
| STUDIO        | Yes (monthly) | Yes        | Receives bookings    | Location + amenities    |
| CAMERA_SHOP   | Yes (monthly) | Yes        | Sells/rents products | Shop + product listings |
| CUSTOMER      | No (free)     | No         | Books/purchases only | Minimal profile         |

### API conventions

- All API routes in `src/app/api/[domain]/route.ts`
- Use Next.js Route Handlers (GET, POST, PUT, DELETE exports)
- Validate input with Zod before processing
- Return consistent JSON shape: `{ data, error, message }`
- Auth check with `requireAuth()` (from `src/lib/auth-helpers.ts`) at top of every protected route — wraps NextAuth v5's `auth()`
- Role check with `requireRole(userId, 'PHOTOGRAPHER')` helper; paid-role checks via `requireActiveSubscription(userId, role)` / `requirePaidRole(userId)`
- Paginate lists: `?page=1&limit=20`, return `{ data, total, page, totalPages }`
- HTTP status: 200 success, 201 created, 400 bad request, 401 unauth, 403 forbidden, 404 not found, 500 server error

### Database conventions

- Prisma models use PascalCase: `User`, `BookingRequest`
- Fields use camelCase: `firstName`, `createdAt`
- Every table has: `id` (cuid), `createdAt`, `updatedAt`
- Soft delete with `deletedAt: DateTime?` — never hard delete user data
- Relations use descriptive names: `booking.customer`, `booking.provider`
- Enums defined in Prisma schema, re-exported as TypeScript types
- Always run `npx prisma generate` after schema changes
- Always create a migration: `npx prisma migrate dev --name descriptive_name`

### Component conventions

- Use shadcn/ui as base — install components via `npx shadcn@latest add [component]`
- Functional components only, named exports
- Props interface defined above component: `interface ProfileCardProps { ... }`
- Client components: `"use client"` only when state/effects/handlers are needed
- Server components by default — fetch data at the component level
- Form state with `react-hook-form` + `zodResolver`
- Loading states: use `Skeleton` component from shadcn/ui
- Error states: show inline error message, never silent failure
- File naming: `kebab-case.tsx` for components, `camelCase.ts` for utilities

### TypeScript conventions

- Strict mode enabled, no `any` — use `unknown` then narrow
- Prefer interfaces over types for object shapes
- Use Zod schemas as single source of truth, infer types: `type User = z.infer<typeof userSchema>`
- Enum values from Prisma, don't duplicate
- Utility types in `src/types/`

### Styling conventions

- Tailwind utility classes, no custom CSS files
- Use `cn()` helper (from `lib/utils.ts`) for conditional classes
- Design tokens: brand palette/type scale/component patterns documented in `docs/design-reference/design-tokens.md` (extracted from the Claude design export at `docs/design-reference/Fgrapher Web UI Kit.html`), wired into `src/app/globals.css` as of phase-1 Step 1. Brand color/typography utilities use compound names to avoid colliding with shadcn's own tokens — e.g. `bg-bg-surface`, `text-text-primary`, `text-heading-md`; see the "Implementation" section at the bottom of `design-tokens.md` for the exact mapping. shadcn's own component primitives (`src/components/ui/*`) are being incrementally rebuilt against these brand tokens (Button/Badge/Card done; still shadcn-default elsewhere)
- Responsive: mobile-first (`base` → `sm` → `md` → `lg`)
- Dark mode: support via `class` strategy (Tailwind + next-themes)
- Spacing scale: stick to Tailwind defaults (4, 8, 12, 16, 20, 24...)
- Max content width: `max-w-7xl` for pages, `max-w-2xl` for forms

## Commands

```bash
# Dev
pnpm dev                          # start dev server (port 3000)
pnpm build                        # production build
pnpm lint                         # ESLint
pnpm format                       # Prettier

# Database
pnpm db:generate                  # prisma generate
pnpm db:migrate:dev               # prisma migrate dev (local only, guarded — see scripts/check-db-safety.mjs)
pnpm db:migrate:deploy            # prisma migrate deploy (used by CI against staging/production)
pnpm db:push                      # prisma db push (no migration)
pnpm db:seed                      # prisma db seed
pnpm db:studio                    # prisma studio (GUI)
pnpm db:reset                     # reset + seed

# Testing
pnpm test                         # vitest
pnpm test:e2e                     # playwright
```

## Environment

Required env vars — see `.env.example` for full list:

- `DATABASE_URL` — Supabase pooled Postgres connection string (used by the app + `prisma migrate`)
- `DIRECT_URL` — Supabase direct (non-pooled) Postgres connection string, used by Prisma Migrate
- `NEXTAUTH_SECRET` — random 32+ char string
- `NEXTAUTH_URL` — `http://localhost:3000` in dev
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`

Note: the Prisma CLI only auto-loads `.env`, not `.env.local`. Keep `DATABASE_URL`/`DIRECT_URL` duplicated in both — `.env` for `prisma generate`/`prisma migrate`, `.env.local` for the Next.js app at runtime. Both are gitignored.

### Database environments

Three separate Supabase projects, one database each — no environment shares a database with another:

| Environment                                                        | Database                                                                                                                                                          | Where configured                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Local dev                                                          | `fgrapher-dev` (Supabase)                                                                                                                                         | `.env` + `.env.local` (gitignored, on-disk only)                                           |
| Vercel Preview (every branch/PR deploy)                            | `fgrapher-dev` (same as local — reused rather than a 4th project, since preview data staying messy/shared with local dev is an acceptable tradeoff at this scale) | Vercel dashboard/CLI, `DATABASE_URL`/`DIRECT_URL` scoped to the **Preview** environment    |
| Vercel Production (`fgrapher.vercel.app` / eventual custom domain) | `fgrapher-prod` (Supabase)                                                                                                                                        | Vercel dashboard/CLI, `DATABASE_URL`/`DIRECT_URL` scoped to the **Production** environment |

Supabase's pooled-connection hostname (`aws-0-<region>.pooler.supabase.com`) is shared infrastructure across every project in a region — dev and prod resolve to the _same host_. The actual project identity lives in the connection string's username (`postgres.<project-ref>`), not the host. `scripts/check-db-safety.mjs` checks the ref, and `pnpm db:reset`/`pnpm db:push` refuse to run against anything not on its explicit allow-list (currently just the dev ref) — see the script for how to extend it if a case genuinely needs to.

**Migration rule: migrations go dev → preview → production, never straight to production.** Run `prisma migrate dev` locally against the dev database first, verify it on a Preview deployment (which shares that same dev database, so this is really just "verify against dev before touching prod"), and only then run `prisma migrate deploy` against production — manually, deliberately, never as part of routine `db:push`/`db:reset` usage, which are dev-only by the guard above.

## Current phase

Phase 12, part 1 of 2 — Admin panel (see `docs/guides/phase-12-admin-launch.md`).
ADMIN role (`requireAdmin()` + `scripts/make-admin.ts`), a distinct `(admin)`
route group (dark top bar, its own sidebar), an overview dashboard (user/
subscription/booking/GMV metrics, health indicators, recent activity — no
charts, same reasoning as Phase 9's shop-analytics deferral), user management
(search/filter, detail page with suspend/verify/soft-delete, all actions logged
to a new `AdminAction` audit table), and a moderation queue for Phase 10's
`Report` model. All 12 phases' _code_ is now built — Phases 0-11 (foundation,
landing page, auth, dashboard, public profiles, browse & search, booking flow,
payments, messaging, marketplace, reviews, polish) plus this admin panel.

**What's deliberately NOT done, and can't be done from here — Phase 12's
Steps 6-8 (production deployment, launch checklist, post-launch ops):** these
aren't code, they're actions in external systems this environment has no
access to — a production Supabase project, a Vercel account/domain, Stripe's
business verification for live mode, a verified Resend sending domain, a
Sentry project, uptime monitoring. No amount of further autonomous coding
closes this gap; it needs a human with those accounts. See
`docs/guides/phase-12-admin-launch.md` Steps 6-8 for the literal checklist
(env vars to set, DNS records, Stripe live-mode setup, cron config, monitoring)
when that time comes — nothing here has abbreviated it.

**Everything that _is_ code-complete but genuinely untested end-to-end**,
because every external integration in this build was developed against
services with no live credentials in this sandboxed environment:

- **Stripe** (Phase 7 subscriptions + Phase 9 marketplace): checkout, the
  5-event webhook, Customer Portal — type-checked against the real installed
  SDK (v22; note it moved `current_period_start/end` onto SubscriptionItems,
  which the code follows, not the older guide assumption), not-configured
  error paths verified non-fatal, but no real payment has ever round-tripped.
  Needs `STRIPE_SECRET_KEY` + `stripe listen` (`scripts/stripe-setup.ts`
  creates the Products/Prices first). Stripe Connect (splitting marketplace
  payouts to individual shops) was never attempted — payments settle to the
  platform account for now.
- **Cloudinary**: uploads no-op gracefully; `next.config.ts` now has the
  `remotePatterns` a real Cloudinary image would need, but that was only
  caught in Phase 11 because no image had ever actually round-tripped through
  next/image's optimizer here — worth double-checking image rendering
  specifically once real credentials land, not just assuming it works because
  the no-op path was clean.
- **Resend**: emails no-op gracefully (every email template in the app is
  written and will send the moment `RESEND_API_KEY` is set — none have been
  visually proofed in an actual inbox).
- **Pusher/Socket.io**: never attempted — Phase 8 messaging and the
  notification bell both use polling instead (chat panel every 4s while open,
  unread badges every 20s/30s). This is a deliberate architecture choice, not
  a stub — swapping in real-time delivery later means adding a transport
  layer, not rewriting the polling call sites.
- **Redis/Upstash**: no caching layer exists; Phase 11 skipped it entirely.

seed.ts creates a synthetic ACTIVE Subscription (no real Stripe IDs) for every
paid-role seed account, plus one seeded `admin@test.com` (password `Test1234!`,
same as every other seed account) for exercising `/admin` locally — keep both
in mind when adding new seed users with paid or admin roles.

Known bug, NOT resolved (see the Phase 4 commit message for the full
investigation): the Follow/Save/Share buttons on `/profile/[username]` don't
respond to clicks in this dev environment specifically when logged in, despite
rendering correctly. Extensively isolated to "authenticated session + any
async delay before a Client Component renders" — reproduces with plain Prisma
queries or even a bare `setTimeout`, unrelated to this feature's own code.
Every other auth-gated interactive feature in the app works fine. Needs a
fresh look with real browser devtools, not headless/CDP testing.

## Rules

- Never commit `.env` or `.env.local`
- Never use `console.log` in production code — use a logger or remove
- Never skip error handling in API routes
- Never use inline styles — Tailwind only
- Always add loading and error states to async UI
- Always validate user input server-side (even if validated client-side)
- Always check subscription status before granting paid-role features
- Customer role must never see upload/sell UI elements
- Prefer Server Components — only add `"use client"` when truly needed
- Commit messages: `type(scope): description` — e.g. `feat(auth): add Google OAuth provider`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
