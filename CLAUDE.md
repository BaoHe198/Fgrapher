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
pnpm db:migrate                   # prisma migrate dev
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

## Current phase

Phase 10 — Reviews & ratings (see `docs/guides/phase-10-reviews.md`). Built on
Phase 4's existing Review model (bookingId already unique 1:1, response field
already there): a StarInput component, a leave-a-review flow (inline prompt on
COMPLETED bookings → modal, eligibility enforced server-side — one review per
booking, 30-day window, edit within 7 days), a standalone `/review/[bookingId]`
page for the email-link flow, provider responses (create + edit within 24h, both
from the profile's reviews tab and a new `/dashboard/reviews` stats page), rating
filter chips, and a generic `Report` model + modal (reused as-is from what Phase
8/messaging also wanted but deferred). avgRating/reviewCount stay computed live
via aggregation queries rather than denormalized Profile columns, consistent with
Phase 4/5's existing approach — deliberately did not add the guide's suggested
`Profile.avgRating/reviewCount/ratingBreakdown` fields, since duplicating a value
that's already computed live just risks drift. Phases 0-9 (foundation, landing
page, auth, dashboard, public profiles, browse & search, booking flow, payments,
messaging, marketplace) are complete.

Real bug caught and fixed while building this: the review modal isn't
mounted/unmounted by its Dialog (only visibility toggles), so its
`useState(initialRating)` only ran once at first render — clicking a *different*
star on the inline prompt after the modal had already mounted kept showing the
stale rating. Fixed with a `useEffect` that resets local state whenever `open`
transitions to true; worth remembering for any other modal that seeds its initial
state from a prop that can change between opens.

Also fixed (Phase 9 follow-through): Stripe's zero-decimal currencies (VND
included) expect the raw amount, not `amount * 100` like USD cents —
`lib/stripe.ts`'s `toStripeAmount()` handles this now. And the reseed cleanup
block was missing Message/Order (no `onDelete: Cascade` from User), so
`pnpm db:seed` broke once real messaging/order test data existed — keep this in
mind when adding models with a User FK; check whether reseed cleanup needs it too.

Known limitation, impossible to close in this environment: there is no live Stripe
account or Stripe CLI here, so checkout/webhook/Customer Portal (both the Phase 7
subscription flow and the Phase 9 marketplace flow) are code-complete and
type-checked against the actually-installed Stripe SDK (v22, which restructured
`current_period_start/end` onto SubscriptionItems — the code follows that, not the
phase guide's older `apiVersion` assumption) but UNTESTED end-to-end. Everything
that doesn't require live Stripe was verified working: pricing page, billing
settings against seeded synthetic ACTIVE subscriptions, both checkout flows'
not-configured error path staying non-fatal, the subscription gates actually
blocking/allowing correctly, and the full shop browse → product detail → cart →
checkout-page UI loop. Needs a real `STRIPE_SECRET_KEY` + `stripe listen` pass
before launch — see `scripts/stripe-setup.ts` for creating the Products/Prices.

seed.ts now creates a synthetic ACTIVE Subscription (no real Stripe IDs) for every
paid-role seed account — required for the new subscription-based gating to not
lock every seeded/test account out; keep this in mind when adding new seed users
with paid roles.

Known gaps carried forward on purpose: Cloudinary and Resend have no live credentials
in this environment, so uploads/emails no-op or show a graceful inline error rather
than crashing — wire up real credentials in `.env.local` to exercise those paths.

Known bug, NOT resolved (see the Phase 4 commit message for the full investigation):
the Follow/Save/Share buttons on `/profile/[username]` don't respond to clicks in this
dev environment specifically when logged in, despite rendering correctly. Extensively
isolated to "authenticated session + any async delay before a Client Component
renders" — reproduces with plain Prisma queries or even a bare `setTimeout`, unrelated
to this feature's own code. Every other auth-gated interactive feature in the app
(bookings, portfolio, listings, settings, services, availability) works fine. Needs a
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
