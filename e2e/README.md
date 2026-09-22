# E2E tests (Playwright)

## Setup

1. Start a disposable local Postgres (never dev/prod — this suite resets the
   database on every run):

   ```bash
   docker run -d --name fgrapher-test-db \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fgrapher_test \
     -p 5433:5432 postgres:16
   ```

2. `cp e2e/.env.test.example e2e/.env.test` (already points at the container
   above; edit if you changed the port/credentials).

3. `pnpm test:e2e` — runs `prisma migrate reset` against `e2e/.env.test`'s
   database, seeds fixtures (`e2e/global-setup.ts`), builds the app
   (`next build && next start`, not `next dev` — closer to what CI exercises
   against a real deployment), and runs every spec in `e2e/*.spec.ts`.

   `pnpm test:e2e:ui` opens Playwright's UI mode for debugging.

CI (`.github/workflows/test.yml`) does the Postgres part differently — a
GitHub Actions `postgres:16` service container, torn down automatically at
the end of the job — but everything else is identical.

### Without Docker (Homebrew Postgres on macOS)

Same contract, different way of getting a throwaway Postgres. This is what
the maintainer's machine runs, verified end to end on 22/09/2026:

```bash
brew install postgresql@17
brew services start postgresql@17          # listens on 5432, not 5433
pg_isready -h localhost -p 5432            # expect "accepting connections"

# Homebrew creates a superuser named after your macOS account, not "postgres",
# so create the role the connection string expects:
psql -d postgres -c "create role postgres login superuser password 'postgres';"
psql -d postgres -c "create database fgrapher_test owner postgres;"
```

Then `cp e2e/.env.test.example e2e/.env.test` and **change both `:5433` to
`:5432`** — a native install owns the default port, whereas the Docker recipe
above remaps to 5433 so it can sit next to one. `scripts/check-e2e-db-safety.mjs`
validates the host and the database _name_, not the port, so either is fine.

One extra step the Docker path doesn't need on a first run: apply the schema
once before the first `pnpm test:e2e`.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fgrapher_test" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/fgrapher_test" \
  pnpm exec prisma migrate deploy
```

This is needed because Playwright starts `webServer` (`pnpm build`) _before_
`globalSetup` runs the reset, and `pnpm build` prerenders `/sitemap.xml`,
which queries `Province`. Against a schema-less database that build fails with
`P2021 The table public.provinces does not exist` — which looks like a code
bug and isn't one. After the first run the schema persists, so this is
genuinely once per machine (or after `dropdb fgrapher_test`).

### Two traps worth knowing about

**The dev server on port 3000.** `playwright.config.ts` has
`reuseExistingServer: !CI`, so if the suite targeted port 3000 it would adopt
a running `next dev` — a server wired to the **dev Supabase database** — right
after `globalSetup` had reset the (separate) local test database. The suite
would then read and write real dev data while looking like it passed. The
local server therefore runs on **3100**; CI, which has no dev server, stays on 3000. `E2E_PORT` overrides it.

**A `DATABASE_URL` exported in your shell.** `pnpm test:e2e` loads
`e2e/.env.test` through `dotenv-cli`, and dotenv never overwrites a variable
that is already set. If you ran `source .env.local` earlier in that terminal,
the dev connection string wins and the safety guard stops the run. Use a fresh
terminal, or:

```bash
env -u DATABASE_URL -u DIRECT_URL pnpm test:e2e
```

### If Prisma refuses with "invoked by Claude Code"

Recent Prisma CLI versions detect an AI agent in the environment and block
`migrate reset --force` — the command `e2e/global-setup.ts` runs — until a
human consents. It is a blanket protection against an agent resetting a
production database; it does not inspect the connection string, so pointing at
`localhost/fgrapher_test` does not satisfy it. A human running `pnpm test:e2e`
in their own terminal never sees it. An agent must ask first and then pass
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` with the exact text of that
consent.

## Known failures as of 22/09/2026

First run of this suite since a local Postgres existed on any developer
machine, so it had drifted from the app. 24 of 34 pass, 1 skips
deliberately, 9 fail. None of the nine is an environment problem — they
are the app having moved and the specs not following. Listed so the next
person does not re-diagnose them:

| Spec                          | What it hits                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking-review` ×2           | Times out driving the booking flow — not yet triaged.                                                                                                               |
| `compliance` (data & privacy) | `waitForEvent` on the data export never fires.                                                                                                                      |
| `marketplace`                 | Reaches checkout and submits; the "payments aren't set up" notice never appears.                                                                                    |
| `provider-onboarding`         | Fills the role profile, clicks Save changes, and no PATCH is sent — client-side validation almost certainly blocks it, since province/ward/address became required. |
| `route-crawl` ×3              | See below.                                                                                                                                                          |

### The route-crawl flake

PHOTOGRAPHER, MODEL and ADMIN land on `/api/auth/error` instead of
`/dashboard`, but only when the rest of the suite runs alongside them. All
four pass when route-crawl runs on its own. What has been ruled out, so
nobody repeats it:

- **Not the login rate limiter.** Passing `LOGIN_IP_RATE_LIMIT_MAX` on the
  command line for a full run changes nothing. (The override itself is
  live — setting it to 2 fails every login after the second, exactly as
  it should.)
- **Not the jwt callback.** It is wrapped in try/catch and logs on
  failure; the log stays empty through a failing run.
- **Not worker count alone.** `--workers=4` still fails two of them.
- **The server logs nothing** — no `[auth][error]`, no warning. Whatever
  produces the error page does not reach Auth.js's error path, which
  points at the sign-in POST itself failing or timing out client-side
  rather than at an authentication decision.

## Running against a preview deployment

`playwright.config.ts` skips `globalSetup` and the local `webServer` entirely
when `BASE_URL` is set, and drives that URL directly instead:

```bash
BASE_URL=https://fgrapher-git-my-branch-bao-he.vercel.app pnpm exec playwright test --project=e2e
```

This is what the CI workflow does against each PR's preview deployment. It
does **not** reset or seed a database for you — the preview deployment's own
`DATABASE_URL` (Vercel's Preview environment) is whatever it's configured to
be, and this suite doesn't control that. See the workflow file for how it's
wired.

## Known gaps this suite works around, on purpose

None of `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, or the Cloudinary env vars are
set for these tests (deliberately — see the root `CLAUDE.md`, which
documents that none of the three are configured anywhere in this project's
sandboxed development either). Rather than silently skip the flows that
touch them, or fake success in a way that would mask a real bug, each
affected test is explicit about exactly where it stops being a real
end-to-end check and starts bridging a gap directly via Prisma
(`e2e/helpers/db.ts`):

- **Subscribing** (`provider-onboarding.spec.ts`) and **buying a product**
  (`marketplace.spec.ts`) stop at the Stripe Checkout handoff — the test
  asserts the app's own graceful "Payments aren't set up" message, then
  activates the role / seeds the order directly, standing in for what the
  `checkout.session.completed` webhook would have done.
- **Cancelling/resuming a subscription** (`subscription-lifecycle.spec.ts`)
  calls real API routes that call Stripe synchronously and silently no-op
  today without a live key (confirmed by reading
  `billing-settings-content.tsx` — it never checks the response). The test
  asserts the request fires with the correct body, then applies the DB
  change the webhook would have made, to verify the UI actually reacts to
  that state correctly.
- **Uploading portfolio media** (`provider-onboarding.spec.ts`) mocks the
  two network calls that leave first-party code (`POST /api/upload/
signature` and the Cloudinary upload itself) while exercising every real
  line of app code around them, including the actual
  `POST /api/portfolio` write.
- **Password reset** can't read the link from an inbox (`sendEmail()`
  no-ops silently when Resend isn't configured) or from the database
  (`VerificationToken` stores only a hash). After submitting the form it
  mints a known token with `issuePasswordResetToken` — the same issuance
  the form used — and visits that link.
- **A profile appearing in search** requires `Profile.isPublished: true`.
  This one isn't a third-party-credential gap — it's a genuine gap in the
  app itself: grepping every read/write of that field turns up no UI
  control, no API route, and no subscription-activation code path that
  ever sets it true. A provider who completes real registration, a real
  subscription, and a real profile edit through the actual UI still never
  appears in `/browse`. The test documents this by setting it directly via
  Prisma with a comment, rather than quietly working around it as if it
  were expected behavior. Worth fixing as its own issue.

If you configure real Stripe test-mode keys and Cloudinary credentials in
`e2e/.env.test` later, these tests still pass — they just exercise less of
the mocked/bridged path and more of the real one. Nothing here assumes the
credentials are absent, it just doesn't require them.

## Visual regression

`e2e/visual/pages.spec.ts` snapshots a handful of main pages under the
`visual-light` and `visual-dark` Playwright projects (`pnpm test:visual`).

**Baselines are platform-specific — Playwright embeds the OS in the
filename** (`landing-visual-dark-linux.png` vs `...-darwin.png` on a Mac).
CI runs on `ubuntu-latest`, so the only baselines that mean anything to it
are ones generated on Linux; a baseline generated by running
`test:visual:update` on a Mac or Windows machine will never match and CI
will report every visual test as "no baseline found" forever. There's no
way around this from a non-Linux machine short of Docker.

**Bootstrapping the real (Linux) baselines**: trigger the
`update-visual-baselines` job manually — GitHub → Actions →
"E2E Tests" → "Run workflow" → check the
`update_visual_baselines` input. It builds the app against a disposable
Postgres exactly like the `e2e` job, runs both visual projects with
`--update-snapshots`, and uploads the resulting PNGs as a `visual-baselines`
artifact — it does **not** commit anything itself. Download the artifact,
drop the PNGs into `e2e/visual/pages.spec.ts-snapshots/`, and commit them.
Re-run this whenever a page's design changes on purpose; an unexpected diff
on a PR means something changed that shouldn't have.

If you're iterating locally on a Mac/Windows machine and just want fast
feedback before pushing, `pnpm test:visual:update` still works fine for
that — those baselines just aren't the ones that matter for CI, so don't
bother committing them.
