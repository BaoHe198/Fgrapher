# Environments

Two databases, not three: `fgrapher-dev` and `fgrapher-prod`. A third
project for a fully separate staging database was considered
(`docs/guides/fgrapher-git-environments.md`, the original 3-environment
plan) and deliberately dropped — Supabase's free tier caps a project at
2 database projects, a third needs a paid plan, and for solo work
Vercel's own per-branch/per-PR Preview deployments already answer "does
this actually work" before promoting to production. `develop` and
every `feature/*`/`fix/*` branch deploy to their own Preview URL
against `fgrapher-dev`; only `master` touches `fgrapher-prod`. If this
project ever grows a second contributor or the free-tier project limit
stops fitting, revisit this — the original 3-environment plan is still
sitting in `docs/guides/` if that becomes worth it again.

No `.env.staging` or `.env.production` file exists or should exist —
production values live only in Vercel's **Production** scope, never on
disk or in git. Local development uses `.env` (Prisma CLI) + `.env.local`
(Next.js runtime), both gitignored; Vercel's **Preview** scope (used by
every non-`master` branch) is configured with the same dev-database
values as local development.

| Variable                                                                    | Development & Preview                                                                                  | Production                                                                   | Where to get it                                      | Secret?                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                              | `fgrapher-dev` pooled connection string                                                                | `fgrapher-prod` pooled connection string                                     | Supabase project → Connect → ORM → Prisma            | Yes                                                                                                     |
| `DIRECT_URL`                                                                | `fgrapher-dev` direct connection string                                                                | `fgrapher-prod` direct connection string                                     | Same Supabase panel, the non-pooled string           | Yes                                                                                                     |
| `NEXTAUTH_SECRET`                                                           | a personal random value                                                                                | a different random value — **never shared with dev**                         | `openssl rand -base64 32`                            | Yes                                                                                                     |
| `NEXTAUTH_URL`                                                              | `http://localhost:3000` locally; leave unset on Preview so the app falls back to Vercel's `VERCEL_URL` | `https://fgrapher.com`                                                       | —                                                    | No                                                                                                      |
| `APP_ENV`                                                                   | `development`                                                                                          | `production`                                                                 | set manually per Vercel scope                        | No                                                                                                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                 | optional — Google OAuth is no-op without it                                                            | a real production OAuth app's credentials                                    | Google Cloud Console → APIs & Services → Credentials | Secret is secret; ID isn't                                                                              |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`                                         | shared dev account, or unset (uploads no-op)                                                           | `prod/` folder convention within the same account                            | Cloudinary dashboard                                 | No (it's `NEXT_PUBLIC_`)                                                                                |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`                              | optional                                                                                               | real production credentials                                                  | Cloudinary dashboard                                 | Secret is secret; key ID isn't                                                                          |
| `STRIPE_SECRET_KEY`                                                         | `sk_test_...` or unset                                                                                 | `sk_live_...`                                                                | Stripe Dashboard → Developers → API keys             | Yes                                                                                                     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                        | `pk_test_...` or unset                                                                                 | `pk_live_...`                                                                | Same page                                            | No (it's `NEXT_PUBLIC_`, but still mode-specific — don't cross-wire test/live)                          |
| `STRIPE_WEBHOOK_SECRET`                                                     | from `stripe listen`'s own output                                                                      | from the production webhook endpoint (live mode)                             | Stripe CLI locally; Dashboard → Webhooks per mode    | Yes                                                                                                     |
| `STRIPE_PRICE_<ROLE>_MONTHLY` / `_YEARLY` (12 vars, one pair per paid role) | test-mode price IDs from `scripts/stripe-setup.ts`                                                     | **live-mode price IDs — created separately, never inherited from test mode** | `scripts/stripe-setup.ts` output                     | No, but treat as environment-critical — wrong value silently charges the wrong amount or fails checkout |
| `RESEND_API_KEY`                                                            | optional — email no-ops without it                                                                     | real key, sends to real recipients                                           | Resend dashboard                                     | Yes                                                                                                     |
| `CRON_SECRET`                                                               | optional locally                                                                                       | a real value                                                                 | generate like `NEXTAUTH_SECRET`                      | Yes                                                                                                     |
| `NEXT_PUBLIC_APP_NAME`                                                      | `Fgrapher`                                                                                             | `Fgrapher`                                                                   | —                                                    | No                                                                                                      |
| `NEXT_PUBLIC_APP_URL`                                                       | `http://localhost:3000`                                                                                | `https://fgrapher.com`                                                       | —                                                    | No                                                                                                      |

## Non-production behavior gated by `APP_ENV`

- **Environment banner**: a thin blue bar at the top of the UI whenever
  `APP_ENV` isn't `production` — covers local dev and every Preview
  deployment — so it's never ambiguous when you're looking at
  non-production data. (`APP_ENV=staging` still exists as a valid value
  in `src/lib/env.ts`'s schema and renders its own orange banner, kept
  for if a real staging environment gets added back later — nothing
  sets it today.)
- **Analytics**: disabled outside `production`.
- **Outbound email on staging** (`STAGING_TEST_INBOX` redirect in
  `lib/email.ts`): dormant with the current 2-environment setup, since
  nothing runs with `APP_ENV=staging` — Preview deployments run with
  `APP_ENV=development`, which already no-ops email entirely unless
  `RESEND_API_KEY` is deliberately set on Preview (not recommended,
  since that would send real email from every branch's preview).
- **Stripe key selection**: `development`/Preview use test-mode keys;
  `production` uses live-mode keys. Selected by which `STRIPE_*` values
  are actually set in that Vercel scope, not by additional `APP_ENV`
  branching in the Stripe client itself.

## Database safety

`scripts/check-db-safety.mjs` allow-lists `fgrapher-dev`'s project ref
for `db:push`/`db:reset`/`db:migrate:dev` — anything else, including
`fgrapher-prod`'s ref, is refused outright. This is why `fgrapher-prod`
never needs its own entry in that list: it's supposed to stay
unreachable from those commands permanently.
