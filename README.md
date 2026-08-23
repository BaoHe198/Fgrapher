# Fgrapher

Social-media-style booking & marketplace platform for the photography/
videography industry in Vietnam.

Full project conventions, architecture, and the current MVP-scope
constraints live in [`CLAUDE.md`](./CLAUDE.md) — read that first. This
file covers the basics: setup, commands, and how to re-enable the
features currently hidden behind flags.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
cp .env.example .env         # same DATABASE_URL/DIRECT_URL — Prisma CLI only reads .env
pnpm db:migrate:dev
pnpm db:seed
pnpm dev
```

See `.env.example` for what each variable is and where to get it, and
CLAUDE.md's "Environment" section for why both `.env` and `.env.local`
are needed.

## Commands

```bash
pnpm dev                 # dev server (port 3000)
pnpm build                # production build
pnpm lint                 # ESLint
pnpm test:e2e              # Playwright (needs a disposable Postgres — see e2e/README.md)
pnpm db:studio             # Prisma Studio (GUI)
```

Full command list in CLAUDE.md's "Commands" section.

## Feature flags

Three flags in `src/lib/env.ts` (validated) / `src/lib/features.ts`
(exported as `features.*`), all default `false`. Disabled code is never
deleted — see `docs/FEATURES.md`'s "Feature flags" table for exactly
what each one hides and why, and `docs/MVP_SCOPE.md` for the full
inventory of MVP vs. out-of-scope code.

| Flag                  | What it gates                                                                                                   | To re-enable                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BILLING_ENABLED`     | Stripe Checkout/Portal, subscription billing UI                                                                 | Set `BILLING_ENABLED="true"` in the relevant environment's env vars. Requires a real `STRIPE_SECRET_KEY` and running `scripts/stripe-setup.ts` first to create the Products/Prices Stripe needs — see CLAUDE.md's "Current phase" section for what's untested. Currently off because Stripe doesn't support Vietnam-registered merchant accounts; check that's still true before flipping this. |
| `MARKETPLACE_ENABLED` | `/shop`, `/cart`, `/checkout`, the Camera Shop role, and every `products`/`shop-products`/`cart`/`orders` route | Set `MARKETPLACE_ENABLED="true"`. No other setup required — the flag alone un-404s the routes and un-hides the Camera Shop role from registration/`/browse`/pricing/nav.                                                                                                                                                                                                                        |
| `SOCIAL_FEED_ENABLED` | The Follow button/count and `/api/follows*`                                                                     | Set `SOCIAL_FEED_ENABLED="true"`. Note: `Post`/`Like`/`Comment` are modeled in the schema but were never wired to any UI or API, flag or no flag — re-enabling this only brings back Follow.                                                                                                                                                                                                    |

Each flag is a plain `"true"`/`"false"` string (not any other truthy
value — see `booleanFlag` in `src/lib/env.ts` for why). After changing
one, redeploy (or restart `pnpm dev` locally) for the new value to take
effect — these are read once at server startup, not per-request.
