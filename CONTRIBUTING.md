# Contributing

## Branch model

**Two databases, not three** — `fgrapher-dev` (local development,
reused for every Vercel Preview deployment) and `fgrapher-prod`
(production only). A separate `fgrapher-staging` database was
deliberately skipped: Supabase's free tier caps a project at 2 database
projects, a third would require a paid plan, and this is solo work
where Vercel's own per-branch/per-PR Preview deployments already serve
as the "does this actually work" check before promoting to production —
see `docs/ENVIRONMENTS.md` for the reasoning.

- **`master`** — production. Deploys automatically to `fgrapher.com` /
  the production Vercel environment. Protected: no direct pushes, PR
  required, status checks must pass.
- **`develop`** — integration branch. Deploys to its own Vercel Preview
  URL, against the same `fgrapher-dev` database local dev uses.
  Protected: PR required.
- **`feature/*`, `fix/*`, `chore/*`, `hotfix/*`** — work in progress.
  Each gets its own Vercel Preview deployment automatically on push,
  also against `fgrapher-dev`.

> This repo's default branch is named `master`, not `main` — some
> tooling/docs elsewhere use `main` as the generic example name for
> "the production branch"; here that's `master`. Don't rename it without
> updating the Vercel Git integration's Production Branch setting and
> every branch-protection rule at the same time — they all have to move
> together or deploys/protection silently stop matching.

## Branch naming

`type/short-description`, e.g. `feature/model-role`,
`fix/browse-filter-race`, `chore/upgrade-prisma`,
`hotfix/webhook-signature-check`.

## Commit format

`type(scope): description`

**Types:** `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `chore`

**Scopes** (this project's actual feature areas): `auth`, `booking`,
`search`, `payments`, `profile`, `messaging`, `marketplace`, `reviews`,
`admin`, `model`, `ui`, `db`, `i18n`, `test`

Examples from this repo's actual history:

```
feat(auth): merge sign-in and sign-up into a single tabbed page
fix(browse): stop rapid filter clicks from clobbering each other
feat(model): add MODEL role — data layer, safety, and UI
docs: add architecture, features, operations, and development references
chore(test): add Playwright E2E/visual-regression suite and CI workflow
```

## PR process

1. Branch off `develop` (not `master`) for anything that isn't a
   `hotfix/*`.
2. Open a PR into `develop` using the PR template — fill in every
   section, especially "How to test." Vercel comments the PR with a
   Preview deployment URL — use it as the actual pre-merge check, since
   there's no separate staging environment.
3. Once merged to `develop` and confirmed working via that branch's own
   Preview deployment, open a second PR from `develop` into `master` to
   promote it to production.
4. `hotfix/*` branches may PR directly into `master` when something in
   production is actively broken — still through a PR, never a direct
   push, even then.

## Migrations

**Migrations never run directly against production.** They're created
locally against the dev database (`pnpm db:migrate:dev`) — which is
also what every Preview deployment (including `develop`'s own) already
reads, so a migration is live for review the moment it's applied
locally, no separate deploy step needed for `develop`. Migrations reach
production only via CI on merge to `master`, behind a required manual
approval (see `docs/MIGRATIONS.md`). Never run `prisma migrate dev`,
`db:push`, or `db:reset` with `DATABASE_URL` pointed at anything but
your own local dev database — see `scripts/check-db-safety.mjs`, which
refuses to run `db:push`/`db:reset` against anything not on its
explicit allow-list.

See `docs/MIGRATIONS.md` for the full migration workflow, including how
to write additive-only migrations and the three-step pattern for
breaking schema changes.

## CI secrets

Set under GitHub → Settings → Secrets and variables → Actions:

| Secret                    | Used by                                    | Value                                      |
| ------------------------- | ------------------------------------------ | ------------------------------------------ |
| `PRODUCTION_DATABASE_URL` | `.github/workflows/migrate-production.yml` | `fgrapher-prod`'s pooled connection string |

No `STAGING_DATABASE_URL` — there's no separate staging database (see
"Branch model" above). `ci.yml` needs no secrets — third-party
integrations (Stripe/Cloudinary/Resend/Google OAuth) no-op without real
credentials, and its database needs are covered by its own disposable
Postgres service container, not a secret. `test.yml`'s `e2e`/
`visual-regression` jobs run against their own disposable Postgres
service container too, not a secret; its `preview-smoke` job reads
whatever the Vercel Preview deployment itself is configured with, not a
GitHub secret.

`migrate-production.yml` needs a `production` GitHub Environment with a
required reviewer configured (Settings → Environments) — see that
workflow file's trailing comment for the exact one-time setup step.
`PRODUCTION_DATABASE_URL` can live there as an environment secret
instead of a repo-level secret for a stronger boundary (only workflow
runs that pass the approval gate can read it) — either works with the
workflow as written.
