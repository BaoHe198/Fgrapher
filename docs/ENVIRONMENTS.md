# Environments

Every variable used by the app, what it should be in each of the three
environments, where to get it, and whether it's a secret.

No `.env.staging` or `.env.production` files exist or should exist —
those values live only in Vercel's Environment Variables settings
(Production / Preview scopes), never on disk or in git. Local
development uses `.env` (Prisma CLI) + `.env.local` (Next.js runtime),
both gitignored.

| Variable                                                                          | Development                                        | Staging                                                                                        | Production                                                                   | Where to get it                                          | Secret?                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                    | `fgrapher-dev` pooled connection string            | `fgrapher-staging` pooled connection string                                                    | `fgrapher-prod` pooled connection string                                     | Supabase project → Connect → ORM → Prisma                | Yes                                                                                                     |
| `DIRECT_URL`                                                                      | `fgrapher-dev` direct connection string            | `fgrapher-staging` direct connection string                                                    | `fgrapher-prod` direct connection string                                     | Same Supabase panel, the non-pooled string               | Yes                                                                                                     |
| `NEXTAUTH_SECRET`                                                                 | a personal random value                            | a different random value                                                                       | a different random value again — **never shared with staging**               | `openssl rand -base64 32`                                | Yes                                                                                                     |
| `NEXTAUTH_URL`                                                                    | `http://localhost:3000`                            | leave unset; the app should fall back to Vercel's `VERCEL_URL` for Preview                     | `https://fgrapher.com`                                                       | —                                                        | No                                                                                                      |
| `APP_ENV`                                                                         | `development`                                      | `staging`                                                                                      | `production`                                                                 | set manually per Vercel scope                            | No                                                                                                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                       | optional — Google OAuth is no-op without it        | same value can be shared across dev/staging if using one OAuth app with multiple redirect URIs | a real production OAuth app's credentials                                    | Google Cloud Console → APIs & Services → Credentials     | Secret is secret; ID isn't                                                                              |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`                                               | shared dev account, or unset (uploads no-op)       | `staging/` folder convention within the same account                                           | `prod/` folder convention within the same account                            | Cloudinary dashboard                                     | No (it's `NEXT_PUBLIC_`)                                                                                |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`                                    | optional                                           | same Cloudinary account as production, different folder                                        | real production credentials                                                  | Cloudinary dashboard                                     | Secret is secret; key ID isn't                                                                          |
| `STRIPE_SECRET_KEY`                                                               | `sk_test_...` or unset                             | `sk_test_...`                                                                                  | `sk_live_...`                                                                | Stripe Dashboard → Developers → API keys                 | Yes                                                                                                     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                              | `pk_test_...` or unset                             | `pk_test_...`                                                                                  | `pk_live_...`                                                                | Same page                                                | No (it's `NEXT_PUBLIC_`, but still mode-specific — don't cross-wire test/live)                          |
| `STRIPE_WEBHOOK_SECRET`                                                           | from `stripe listen`'s own output                  | from the staging webhook endpoint (test mode)                                                  | from the production webhook endpoint (live mode)                             | Stripe CLI locally; Dashboard → Webhooks per environment | Yes                                                                                                     |
| `STRIPE_PRICE_<ROLE>_MONTHLY` / `_YEARLY` (12 vars total, one pair per paid role) | test-mode price IDs from `scripts/stripe-setup.ts` | test-mode price IDs (can reuse dev's)                                                          | **live-mode price IDs — created separately, never inherited from test mode** | `scripts/stripe-setup.ts` output                         | No, but treat as environment-critical — wrong value silently charges the wrong amount or fails checkout |
| `RESEND_API_KEY`                                                                  | optional — email no-ops without it                 | real key, but outbound mail should redirect to a test inbox (see below)                        | real key, sends to real recipients                                           | Resend dashboard                                         | Yes                                                                                                     |
| `CRON_SECRET`                                                                     | optional locally                                   | a real value, matching what's configured on the Vercel cron                                    | a different real value                                                       | generate like `NEXTAUTH_SECRET`                          | Yes                                                                                                     |
| `NEXT_PUBLIC_APP_NAME`                                                            | `Fgrapher`                                         | `Fgrapher (Staging)`                                                                           | `Fgrapher`                                                                   | —                                                        | No                                                                                                      |
| `NEXT_PUBLIC_APP_URL`                                                             | `http://localhost:3000`                            | `https://staging.fgrapher.com`                                                                 | `https://fgrapher.com`                                                       | —                                                        | No                                                                                                      |

## Non-production behavior gated by `APP_ENV`

- **Environment banner**: a thin colored bar at the top of the UI on
  `staging` (orange) and `development` (blue) — nothing on `production`
  — showing the environment name, so it's never ambiguous which
  environment is on screen.
- **Analytics**: disabled outside `production`.
- **Outbound email**: on `staging`, every email is redirected to a test
  inbox rather than a real recipient's address — real `RESEND_API_KEY`,
  fake destination. `development` already no-ops entirely without a key.
- **Stripe key selection**: `development`/`staging` use test-mode keys;
  `production` uses live-mode keys. Selected by which `STRIPE_*` values
  are actually set in that Vercel scope, not by additional `APP_ENV`
  branching in the Stripe client itself.

## Note on the current single-database state

As of this writing, only one Supabase project (`fgrapher-dev`, ref
`oikhakndcpezqaxpakzv`) exists — it currently serves both local
development and the deployed Vercel project (see root `CLAUDE.md`'s
Database environments table). The `fgrapher-staging` and `fgrapher-prod`
rows above describe the target state once those projects are created
(`docs/guides/fgrapher-git-environments.md` Part C1, manual) — update
this table's Supabase project refs once they exist.
