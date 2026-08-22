# Fgrapher — Git workflow & 3 môi trường

Thiết lập quy trình chuẩn cho dự án **đã deploy sẵn** lên Vercel.

Một số bước Claude Code làm được, một số bạn phải tự thao tác trên dashboard (GitHub, Vercel, Supabase, Stripe). Tôi đánh dấu rõ từng loại.

---

## Kiến trúc mục tiêu

```
Branch          Môi trường     Database          Stripe      URL
──────────────────────────────────────────────────────────────────────────
(local)     →   Development    dev DB            test        localhost:3000
feature/*   →   Preview        staging DB        test        *.vercel.app
develop     →   Staging        staging DB        test        staging.fgrapher.com
main        →   Production     production DB     live        fgrapher.com
```

**Luồng code:** `feature/x` → PR vào `develop` → kiểm tra trên staging → PR vào `main` → production.

**Luồng migration:** tạo ở local → tự động apply lên staging khi merge develop → apply lên production khi merge main (có bước phê duyệt thủ công). **Không bao giờ** chạy `migrate dev` trực tiếp vào staging hay production.

---

## Phần A — Kiểm tra hiện trạng

### A1. Audit repo

**Prompt cho Claude Code:**

```
Audit the current state of this repository and its deployment setup.
Report on each item — do not change anything yet:

1. Git: which branches exist locally and on the remote, which branch is
   checked out, whether there are uncommitted changes, and what the
   recent commit history looks like (are commits following any
   convention?)

2. Remote: the origin URL, whether it is GitHub, and whether the repo
   is public or private

3. .gitignore: confirm it covers .env, .env.local, .env.*.local,
   node_modules, .next, .vercel, .mcp.json, and any credential files.
   Then check the full git history — not just the current tree — for
   secrets that were ever committed:
   git log --all --full-history --source -- .env* .mcp.json
   Report anything found.

4. Environment variables: list every variable referenced in the code
   (search for process.env) and cross-check against .env.example.
   Report any used but undocumented, or documented but unused.

5. Database: read the DATABASE_URL host from .env.local and tell me
   which Supabase project it points at. Check whether the same project
   is also serving production by looking at any deployment config in
   the repo.

6. Migrations: list prisma/migrations and say whether the history looks
   clean or has been reset at some point.

7. CI: does .github/workflows exist, and what runs today?

Give me the report as a checklist with a status for each item.
```

⚠️ **Nếu báo cáo cho thấy `.env` hoặc `.mcp.json` từng bị commit** — dừng lại, xử lý trước mọi thứ khác. Xoay vòng toàn bộ secret: Supabase database password, `NEXTAUTH_SECRET`, Stripe keys, Cloudinary, Resend, Supabase PAT. Chúng đã nằm trong lịch sử git và ai clone repo đều đọc được.

---

## Phần B — Thiết lập Git

### B1. Branch structure và tài liệu

**Prompt cho Claude Code:**

```
Set up the branch structure for a project that is already deployed
from main.

1. Verify the working tree is clean and main is up to date with origin.
   If there are uncommitted changes, show them to me and stop.

2. Create a develop branch from the current main and push it:
   git checkout main && git pull origin main
   git checkout -b develop && git push -u origin develop

3. Create .github/pull_request_template.md with sections:
   - What changed (short description)
   - Why (link to issue or reason)
   - How to test (concrete steps a reviewer can follow)
   - Screenshots (for UI changes: before and after)
   - Checklist: builds locally, lint passes, tested on mobile,
     migration included if schema changed, translations added if new
     strings, no secrets committed

4. Create .github/ISSUE_TEMPLATE/ with two templates:
   - bug_report.md: what happened, what was expected, steps to
     reproduce, environment (browser/device), screenshots, severity
   - feature_request.md: problem being solved, proposed solution,
     who it affects, alternatives considered

5. Create CONTRIBUTING.md documenting:
   - The branch model: main = production, develop = staging,
     feature/* = work in progress
   - Branch naming: feature/short-description, fix/short-description,
     chore/short-description, hotfix/short-description
   - Commit format: type(scope): description
     types: feat, fix, refactor, perf, style, docs, test, chore
     scopes from this project: auth, booking, search, payments,
     profile, messaging, marketplace, reviews, admin, ui, db, i18n
     Include real examples using this codebase's actual areas
   - The PR process
   - The rule that migrations never run directly against staging or
     production

6. Create a CODEOWNERS file with me as owner of everything for now.

7. Commit all of this to develop and push.
```

### B2. Branch protection — **thủ công trên GitHub**

**Settings → Branches → Add branch protection rule**

**Rule cho `main`:**
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging (chọn các check sau khi tạo CI ở phần D)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ❌ Không bật "Allow force pushes", "Allow deletions"

**Rule cho `develop`:**
- Branch name pattern: `develop`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass

Làm một mình thì có thể bỏ "Require approvals", nhưng vẫn giữ PR để có chỗ đọc lại diff trước khi merge.

### B3. Git hooks

**Prompt cho Claude Code:**

```
Add git hooks so mistakes get caught before reaching the remote.

1. Install: pnpm add -D husky lint-staged @commitlint/cli
   @commitlint/config-conventional
   Then: npx husky init

2. Pre-commit hook: run lint-staged.
   Configure in package.json:
   - *.{ts,tsx}: eslint --fix, prettier --write
   - *.{json,md,css}: prettier --write

3. Commit-msg hook: run commitlint.
   Create commitlint.config.js extending config-conventional, with the
   custom scopes listed in CONTRIBUTING.md.

4. Pre-push hook: npx tsc --noEmit so type errors never reach a PR.
   Keep it fast — do not run the full build or test suite here.

5. Add a secret scan to pre-commit: block the commit if any staged file
   contains sk_live_, sk_test_, sbp_, a JWT starting with eyJ, or a
   line matching DATABASE_URL=postgres. Print the offending file and
   line number.

Test each hook by deliberately triggering it and confirm it blocks.
```

---

## Phần C — Ba môi trường

### C1. Supabase projects — **thủ công**

Hiện tại bạn có một project. Cần ba:

| Project | Dùng cho | Ghi chú |
|---|---|---|
| `fgrapher-dev` | Local development | Có thể dùng project hiện tại |
| `fgrapher-staging` | Staging + preview deploys | Tạo mới |
| `fgrapher-prod` | Production | Tạo mới, bật PITR |

Với mỗi project mới:
1. supabase.com → **New project** → region **Singapore** (gần VN nhất)
2. Đặt database password mạnh → **lưu vào password manager ngay**
3. Bấm **Connect** ở thanh trên → tab **ORM** → **Prisma** → copy hai connection string
4. Riêng production: Settings → Database → bật **Point-in-Time Recovery**

⚠️ Đặt tên có hậu tố `-dev`, `-staging`, `-prod` rõ ràng. Sau này nhìn dashboard biết ngay đang ở đâu — đây là thứ ngăn bạn xóa nhầm database thật lúc 2 giờ sáng.

### C2. Environment variables

**Prompt cho Claude Code:**

```
Restructure environment variable management for three environments.

1. Rewrite .env.example as the complete documented template. Group by
   section with a comment above each explaining what it is and where to
   get it. Add a header comment naming the three environments and which
   values differ between them.

2. Create docs/ENVIRONMENTS.md listing every variable in a table with
   columns: variable, development value, staging value, production
   value, where to obtain it, and whether it is secret. Do not create
   .env.staging or .env.production files — those values live only in
   Vercel.

3. Add runtime validation with zod so a missing variable fails loudly
   at startup rather than silently at request time.
   Create src/lib/env.ts:
   - Schema for all server variables and all NEXT_PUBLIC_ ones
   - Parse process.env at module load
   - Export the typed result
   - On failure, throw listing exactly which variables are missing
   Import it in next.config.js so the build fails fast.

4. Add an APP_ENV variable (development | staging | production),
   separate from NODE_ENV. Use it for:
   - A coloured environment banner in the UI on non-production: a thin
     bar at the top, orange for staging, blue for development, nothing
     on production, showing the environment name. This is so I never
     confuse which environment I am looking at.
   - Disabling analytics and redirecting all outbound email to a test
     inbox on non-production
   - Selecting which Stripe keys to use

5. Add scripts/check-env.ts that refuses to run destructive Prisma
   commands when DATABASE_URL points at the production host. Wire it
   into db:reset and db:push in package.json so they abort with a
   clear message naming which database was detected.

6. Update package.json scripts:
   db:migrate:dev      prisma migrate dev (local only, guarded)
   db:migrate:deploy   prisma migrate deploy (used by CI)
   db:studio           prisma studio against .env.local
   Remove or guard anything that could reset a shared database.
```

### C3. Vercel — **thủ công**

**Git integration** (Settings → Git):
- Production Branch: `main`
- Bật automatic deployments cho các branch khác (tạo preview)

**Environment Variables** (Settings → Environment Variables)

Vercel có ba scope: Production, Preview, Development. Tick đúng scope cho từng biến:

| Biến | Production | Preview | Ghi chú |
|---|---|---|---|
| `DATABASE_URL` | prod pooler | staging pooler | Khác nhau |
| `DIRECT_URL` | prod direct | staging direct | Khác nhau |
| `APP_ENV` | `production` | `staging` | |
| `NEXTAUTH_URL` | `https://fgrapher.com` | để trống, dùng `VERCEL_URL` | |
| `NEXTAUTH_SECRET` | secret riêng | secret khác | **Không dùng chung** |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` | |
| `STRIPE_WEBHOOK_SECRET` | từ live endpoint | từ test endpoint | |
| `STRIPE_PRICE_*` | live price IDs | test price IDs | Khác nhau hoàn toàn |
| `CLOUDINARY_*` | folder `prod/` | folder `staging/` | Cùng account, khác folder |
| `RESEND_API_KEY` | key thật | key thật | Staging redirect về test inbox |
| `SENTRY_DSN` | prod project | staging project | |

**Staging domain** (Settings → Domains):
- Add `staging.fgrapher.com` → Assign to branch `develop`
- Chưa có domain riêng thì Vercel tự cấp URL cố định dạng `fgrapher-git-develop-username.vercel.app`

**Deployment Protection** (Settings → Deployment Protection):
- Bật **Vercel Authentication** cho Preview environment, để staging không bị Google index và người ngoài không truy cập được

### C4. Stripe — **thủ công**

Stripe có sẵn Test mode và Live mode, mỗi mode cần webhook endpoint riêng.

**Test mode** (dev + staging):
1. Developers → Webhooks → Add endpoint
2. URL: `https://staging.fgrapher.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Copy signing secret → Vercel **Preview** scope

**Live mode** (production):
1. Chuyển sang Live mode, làm y hệt
2. URL: `https://fgrapher.com/api/webhooks/stripe`
3. Copy signing secret → Vercel **Production** scope

**Local:** dùng Stripe CLI — `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

⚠️ Products và prices tạo ở Test mode **không tự xuất hiện** ở Live mode. Phải tạo lại thủ công và cập nhật price IDs riêng cho từng scope.

---

## Phần D — CI/CD

### D1. GitHub Actions

**Prompt cho Claude Code:**

```
Create GitHub Actions workflows for this project.

1. .github/workflows/ci.yml — on every pull request to develop or main:
   - Checkout, setup Node 20, setup pnpm with cache
   - pnpm install --frozen-lockfile
   - pnpm lint
   - npx tsc --noEmit
   - npx prisma validate
   - pnpm build using a .env.ci file with placeholder values so it
     compiles without real secrets
   - Run unit tests if any exist
   Fail the PR if any step fails.

2. .github/workflows/migrate-staging.yml — on push to develop:
   - Detect whether prisma/migrations changed in this push
   - If yes, run prisma migrate deploy against STAGING_DATABASE_URL
   - Write which migrations were applied to the job summary
   This must complete before Vercel finishes deploying so the schema
   is ready when the new code goes live.

3. .github/workflows/migrate-production.yml — on push to main:
   - Same as staging but against PRODUCTION_DATABASE_URL
   - Use a GitHub Environment named "production" with a required
     reviewer so the job pauses and waits for my approval before
     touching the production database
   - Log the current migration status before applying
   - On failure, stop and alert clearly — do not continue

4. .github/workflows/e2e.yml — on pull requests to main:
   - Wait for the Vercel preview deployment to be ready
   - Run Playwright against the preview URL
   - Upload the report as an artifact
   - Critical paths only, keep it under 10 minutes

5. Document in CONTRIBUTING.md which secrets must be set in
   GitHub Settings → Secrets and variables → Actions:
   STAGING_DATABASE_URL, PRODUCTION_DATABASE_URL, plus anything else
   the workflows reference.

Add comments to non-obvious steps so the workflows stay maintainable.
```

Sau khi CI chạy lần đầu, quay lại GitHub → Branch protection → chọn các status check vừa tạo làm bắt buộc.

### D2. Migration workflow

**Prompt cho Claude Code:**

```
Document the migration workflow in docs/MIGRATIONS.md.

The rule: migrations are created locally against the dev database,
committed, applied automatically to staging on merge to develop, and to
production on merge to main after manual approval.

Cover:

1. Creating a migration
   - Edit prisma/schema.prisma
   - pnpm db:migrate:dev --name descriptive_name
   - Read the generated SQL before committing — never commit a
     migration you have not reviewed
   - Test the app locally against the new schema
   - Commit the schema change and the migration folder together

2. Writing safe migrations — cover the cases that will actually come up
   in this project:
   - Adding a nullable column: safe
   - Adding a non-nullable column: needs a default, or a three-step
     deploy (add nullable → backfill → make required)
   - Renaming a column: never rename directly on a live table. Add the
     new column, backfill, switch the code, drop the old one in a
     later release
   - Dropping a column: only after all code reading it is deployed
   - Adding an index on a large table: CONCURRENTLY via raw SQL
   - Changing a column type: usually needs add/backfill/swap

3. The three-step pattern for breaking changes, with a concrete worked
   example from this codebase

4. Rollback: what to do when a migration fails halfway on production,
   how to restore from the Supabase PITR snapshot, and how to fix the
   _prisma_migrations table afterwards

5. A pre-production checklist:
   - Reviewed and tested on staging with production-like data volume
   - Backup taken
   - Dependent code deployed or ready to deploy
   - Estimate of how long tables will be locked
   - Rollback plan written down before starting
```

---

## Phần E — Cutover database

Site đang chạy với một database duy nhất. Cần quyết định nó thành gì.

**Khuyến nghị:** biến database hiện tại thành **staging** (nó chỉ chứa seed data), rồi dựng production mới hoàn toàn sạch.

**Prompt cho Claude Code:**

```
I need to reorganize the databases. The current Supabase project serves
fgrapher.vercel.app but contains only seed and test data — no real
users. I want to repurpose it as staging and stand up a clean
production database.

Guide me through this safely:

1. First verify my assumption. Query the current database and report
   row counts for users, profiles, bookings, orders, and messages,
   plus the list of user emails. Tell me if anything looks like real
   user data rather than seed data — if it does, stop and tell me
   before going further.

2. Assuming it is all test data, produce a cutover checklist:
   - Which Vercel environment variables change, and in what order
   - Whether a maintenance window is needed
   - How to verify each step before moving to the next

3. For the new production database:
   - The exact commands to apply the migration history cleanly
     (prisma migrate deploy, not migrate dev)
   - A bootstrap script that inserts only what production genuinely
     needs — my admin account and any reference data — and nothing else
   - Verification queries confirming every table exists and is empty
     apart from the bootstrap rows

4. A smoke test list to run against production after cutover: register,
   log in, create a profile, upload an image, search, open a profile,
   and reach the checkout page — each without errors.

5. Update docs/ENVIRONMENTS.md to reflect the final arrangement.
```

---

## Thứ tự thực hiện

**Ngày 1 — kiểm tra và bảo vệ**
1. A1 — audit repo. Nếu secret từng bị commit, xử lý ngay trước khi làm tiếp
2. B1 — tạo develop branch, PR template, CONTRIBUTING.md
3. B2 — bật branch protection trên GitHub
4. B3 — cài git hooks

**Ngày 2 — hạ tầng môi trường**
5. C1 — tạo hai Supabase project mới
6. C2 — tái cấu trúc env vars + validation
7. C3 — cấu hình Vercel scopes và staging domain
8. C4 — webhook endpoint riêng cho từng mode

**Ngày 3 — tự động hóa**
9. D1 — GitHub Actions, rồi bật status checks bắt buộc
10. D2 — tài liệu migration workflow

**Ngày 4 — cutover**
11. E — chuyển database hiện tại thành staging, dựng production sạch
12. Smoke test toàn bộ trên production

Từ đó trở đi mọi thay đổi đi qua: `feature/x` → PR → `develop` → kiểm tra staging → PR → `main`.

---

## Một lưu ý về mức độ phức tạp

Ba môi trường là chuẩn cho team nhiều người. Nếu bạn làm một mình và muốn nhẹ hơn, có thể bỏ staging: dùng Vercel preview deployment (tự sinh cho mỗi PR, có URL riêng) làm nơi kiểm tra, chỉ giữ hai database là dev và production.

Ba thứ **không nên bỏ** trong mọi trường hợp:
1. Database production tách biệt hoàn toàn, không dùng chung với bất cứ gì
2. Branch protection trên `main` — không ai push thẳng, kể cả bạn
3. Migration lên production phải qua bước phê duyệt thủ công

Ba thứ đó ngăn được phần lớn sự cố nghiêm trọng, và không tốn thêm thời gian hằng ngày.
