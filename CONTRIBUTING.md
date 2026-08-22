# Contributing

## Branch model

- **`master`** — production. Deploys automatically to `fgrapher.com` /
  the production Vercel environment. Protected: no direct pushes, PR
  required, status checks must pass.
- **`develop`** — staging. Deploys automatically to the staging URL.
  Protected: PR required.
- **`feature/*`, `fix/*`, `chore/*`, `hotfix/*`** — work in progress.
  Each gets its own Vercel Preview deployment automatically on push.

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
   section, especially "How to test."
3. Once merged to `develop` and verified on staging, open a second PR
   from `develop` into `master` to promote it to production.
4. `hotfix/*` branches may PR directly into `master` when something in
   production is actively broken — still through a PR, never a direct
   push, even then.

## Migrations

**Migrations never run directly against staging or production.** They're
created locally against the dev database (`pnpm db:migrate:dev`),
committed as part of the PR, and applied automatically by CI on merge —
to staging on merge to `develop`, to production on merge to `master`
(behind a required manual approval — see `docs/MIGRATIONS.md`). Never run
`prisma migrate dev`, `db:push`, or `db:reset` with `DATABASE_URL`
pointed at anything but your own local dev database — see
`scripts/check-db-safety.mjs`, which refuses to run `db:push`/`db:reset`
against anything not on its explicit allow-list.

See `docs/MIGRATIONS.md` for the full migration workflow, including how
to write additive-only migrations and the three-step pattern for
breaking schema changes.
