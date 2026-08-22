# Operations

The runbook for running Fgrapher day to day. Written for someone who is not
the person who built it.

**Read this first:** as of this writing, Fgrapher has not launched — Phase
12's Steps 6-8 (production Supabase project, Vercel production env, Stripe
live mode, a verified Resend domain, Sentry, uptime monitoring) haven't
happened yet (see the root `CLAUDE.md`'s "Current phase" section). Several
sections below describe procedures for tooling that isn't wired up yet
(Sentry, an uptime monitor). Those sections are written as the plan for
when that tooling exists, clearly marked — don't assume they're live today.

## 1. Daily checklist

| Check | Where | What you're looking for |
|---|---|---|
| Error rate | Sentry (not yet configured — see note above; until then, `vercel logs` or the Vercel dashboard's Runtime Logs tab) | New error types, spikes in a known one |
| Failed payments | `/admin` overview card, or Stripe Dashboard → Payments → filter Failed | Anyone stuck in `PAST_DUE` approaching their 7-day grace deadline (`Subscription.graceEndsAt`) |
| Moderation queue | `/admin/reports`, filter Pending — **check the "High priority" badge first** (inappropriate content / appears-to-be-a-minor reports) | Anything sitting unreviewed, especially high-priority |
| New signups | `/admin` overview card ("This month" user growth), or `/admin/users` sorted by newest | Sanity-check volume looks normal, no obvious spam/bot pattern |
| Support inbox | Wherever support email/chat is set up (not yet built in-app — currently the Contact page just sends an email via `/api/contact`) | Anything urgent, anything matching the escalation policy in §3 |

## 2. Account management procedures

All of these are logged automatically via `logAdminAction()` (writes an
`AdminAction` row: adminId, action, targetType, targetId, details) — check
`/admin` → user detail → look for the action in the audit trail (there is
currently no dedicated admin-action viewer UI; query the `admin_actions`
table directly if you need the full history for a user).

### Granting admin access
**Who:** whoever has direct database/server access (this is not an in-app
action — deliberately, since granting admin is too sensitive to expose as
a self-service UI button even to existing admins).
**Steps:** `npx tsx scripts/make-admin.ts user@email.com`. Confirms with
`Granted ADMIN to user@email.com`. Idempotent (upserts).
**Logged:** not automatically — note it manually wherever your team tracks
privileged access grants.

### Manually verifying a provider
**Who:** any admin.
**Steps:** `/admin/users` → find the user → user detail page → verify
action (calls `verifyUser()`, sets `User.isVerified = true`). This is the
general "verified" flag shown on all provider profiles — separate from the
Model-specific `UserRole.verificationStatus` ID-verification queue at
`/admin/verifications` (see docs/guides/fgrapher-prompts-batch-2.md §3b;
that queue's user-facing ID-upload flow isn't enabled yet, so it will be
empty until a launch decision is made).
**Logged:** `action: "verify"` on the user.

### Comping a subscription (free access without payment)
**Who:** any admin.
**Steps:** No dedicated "comp" UI exists today. The closest supported path:
create a `Subscription` row directly for the relevant `UserRole` with
`status: "ACTIVE"` and no `stripeSubscriptionId`/`stripeCustomerId` (this
is exactly the pattern `prisma/seed.ts` uses for every seeded paid
account — "synthetic ACTIVE subscription, no real Stripe IDs"). Do this via
a one-off script or Prisma Studio (`pnpm db:studio`), not raw SQL, so
Prisma's type checking catches mistakes.
**Logged:** nothing automatic — note the grant manually, since it bypasses
the normal Stripe-webhook-driven path entirely.

### Suspending an account
**Who:** any admin.
**Steps:** `/admin/users/[id]` → Suspend, with a required reason and an
optional `until` date (`suspendUser()`, sets `isSuspended`,
`suspendedReason`, `suspendedUntil`).
**What the user experiences:** `isSuspended` isn't currently enforced as a
login/access block anywhere in the code — it's a flag surfaced to admins,
not yet wired into `requireAuth()` or the proxy. **This is a real gap**:
suspending a user today records the suspension but does not actually stop
them from using the app. Treat suspension as a paper trail until this is
wired up, not as an active control.
**Logged:** `action: "suspend"`, with reason/until in details.
**Unsuspend:** same page, Unsuspend action (`unsuspendUser()`, clears all
three fields). Logged as `action: "unsuspend"`.

### Handling a deletion request
**Who:** any admin.
**Steps:** `/admin/users/[id]` → Delete (`softDeleteAdminUser()`, sets
`User.deletedAt`). This is a **soft** delete — per the root `CLAUDE.md`
rule ("never hard delete user data"), the row and all related data stay in
the database; `deletedAt` just excludes the user from queries that check
for it (search results, `getPublicProfileUser`, admin user list). Related
rows (Bookings, Reviews, Posts, etc.) are **not** cascade-soft-deleted —
only the `User` row itself gets `deletedAt` set.
**What's retained and why:** everything, indefinitely, as of this writing.
There is no automated purge job. **This is a genuine compliance gap** if
Fgrapher needs to support a legal "right to erasure" — soft delete alone
doesn't satisfy that; it only satisfies "stop showing this publicly."
Flag this to whoever owns legal/compliance before treating a soft delete
as fulfilling a formal deletion request.
**Logged:** `action: "delete"`.

### Merging duplicate accounts
**Who:** any admin, but do this carefully — no tooling exists for it.
**Steps:** There is no merge feature. This requires manual, direct
database work: reassign the losing account's `Booking`, `Review`,
`Message`, `Order`, `Follow` rows (foreign keys) to the surviving
`User.id`, then soft-delete the losing account. Do this inside a single
`db.$transaction` if scripting it, and back up both rows' data first (see
§5's backup procedure) — there's no undo.
**Logged:** nothing automatic — log it manually, including which account
was kept and which was merged away.

### Resetting a user's password on their behalf
**Who:** any admin, only when the user can't complete the normal
self-service flow (which is `/forgot-password` → emailed reset link, 1-hour
expiry — see `resetPasswordEmailHtml` in `lib/email.ts`).
**Steps:** no dedicated admin UI for this. Direct the user to
`/forgot-password` first — it's the only tested path. If email delivery is
the actual blocker (no `RESEND_API_KEY` configured — see root `CLAUDE.md`'s
untested-integrations note, or an email delivery issue), the fallback is a
direct database update of `User.passwordHash` with a fresh bcrypt hash,
done by someone with database access — not currently an admin-panel action.
**Logged:** manually, since it isn't an in-app action.

## 3. Content moderation

**Queue:** `/admin/reports`, tabs for Pending/Reviewing/Resolved/Dismissed.
Sorted with high-priority reports (`priority: "HIGH"` — currently set only
for the "Inappropriate content" and "Appears to be a minor" reasons, see
`HIGH_PRIORITY_REPORT_REASONS` in `lib/constants/index.ts`) always at the
top, regardless of age.

**Decision criteria by reason:**

| Reason | Typical action |
|---|---|
| Spam | Dismiss if a one-off; suspend (manual, see §2's caveat) if repeated |
| Fake | Investigate the profile against its claims; suspend if confirmed fake |
| Offensive | Remove the specific content if possible (no in-app content-removal tool yet — contact the user to edit/remove, or suspend if severe) |
| Off-topic | Usually dismiss with a note; educate the reporter if it's a pattern of confusion |
| Personal information | Remove/redact if the platform itself is hosting it; escalate if it's a doxxing attempt |
| Inappropriate content | **High priority.** Review the content directly, remove if it violates `/guidelines`, suspend for repeat/severe violations |
| Appears to be a minor | **High priority — see escalation policy below, do not just "resolve" this.** |
| Other | Read the free-text description; triage manually |

**Documenting a decision:** every resolution takes an optional note
(`resolveReport()`'s `note` param, stored as `Report.reviewNote`) —
always fill it in for anything beyond an obvious dismiss, since it's the
only record of *why* a decision was made.

**Escalation policy — suspected minor, threats, or illegal content:**
1. **Act immediately** — don't let this sit in the normal queue rotation.
2. **Preserve evidence first** — screenshot/export the reported content
   and the reporting details before taking any action that might remove
   or alter it. `Report.targetId` + `targetType` point at the specific
   row; capture it before you touch anything.
3. **Do not delete before recording.** Soft-delete or suspend only after
   evidence is preserved.
4. For a suspected minor specifically: this is also directly covered by
   the `/guidelines` content policy and the Model verification flow
   (§3b of the batch prompts) — cross-reference whether the account has
   gone through age verification at all.
5. Report to the appropriate authorities where required by law — this is
   a legal obligation in many jurisdictions for suspected CSAM, not
   optional company policy. If you're not sure of the reporting
   obligation in your jurisdiction, treat "when in doubt, report" as the
   default.

## 4. Payments operations

Everything here assumes Stripe is configured (`STRIPE_SECRET_KEY` set) —
in an environment without it, every Stripe-touching call throws
`StripeNotConfiguredError` and none of this applies yet.

- **Issuing a refund:** `refundPayment(paymentIntentId)` in `lib/stripe.ts`
  — currently only called automatically from `updateOrderStatus` when a
  marketplace order is cancelled (best-effort — failures are swallowed,
  not surfaced, so **always verify the refund actually happened in the
  Stripe Dashboard**, don't trust the app's silence as confirmation).
  There's no admin UI to trigger a one-off refund outside that flow —
  use the Stripe Dashboard directly for anything else (subscription
  refunds, partial refunds).
- **Handling a chargeback:** no in-app handling exists. Chargebacks
  surface as Stripe Dashboard disputes / `charge.dispute.created` webhook
  events, which **this app's webhook handler does not currently
  subscribe to** (`/api/webhooks/stripe` only handles the 5 events listed
  in `docs/ARCHITECTURE.md` §7). Respond to disputes directly in the
  Stripe Dashboard; there's no automated sync back to `Subscription`/
  `Order` status.
- **Investigating a failed payment:** `Subscription.status = "PAST_DUE"`
  plus `graceEndsAt` tells you the deadline; the underlying reason lives
  in Stripe (Dashboard → Customer → payment history) — the app only
  stores the fact that it failed, not the decline reason.
- **Reconciling a payout dispute:** payments currently settle to the
  single platform Stripe account (Stripe Connect for per-shop payouts was
  never implemented — see `docs/ARCHITECTURE.md` §7). There is no
  automatic payout splitting to reconcile; if a shop disputes what
  they're owed, it's a manual calculation against their `Order` rows
  (`shopId`, `totalPrice`, `status`) cross-referenced with the Stripe
  Dashboard's payout history.
- **What to tell a user:**
  - *Payment failed*: "Your card was declined — update your payment
    method from Billing settings before [graceEndsAt date] to avoid any
    interruption. Your profile stays fully active until then."
  - *Refund requested (booking)*: bookings don't currently collect
    payment at all (see `docs/FEATURES.md` §6 — no Stripe flow exists for
    bookings, only for subscriptions and marketplace orders), so a
    "refund my booking" request usually means the user is confused about
    what was actually charged — check `/admin/users/[id]` for their
    actual `Payment`/`Order` history before promising anything.
  - *Refund requested (marketplace order)*: cancel the order via
    `/dashboard/shop-orders` (shop-side) or check with the shop; refund
    is attempted automatically on cancellation.

## 5. Database operations

- **Querying production safely:** use `scripts/report-row-counts.ts`
  (read-only, lists every table + row count) as a template for anything
  ad hoc — it deliberately does nothing but `SELECT COUNT(*)`. For
  anything beyond counts, connect with a read-only role if one exists, or
  be extremely deliberate about every statement you run interactively.
- **Manual backups:** Supabase takes automatic daily backups on paid
  plans (check the current plan's retention window in the Supabase
  dashboard — this isn't something the app configures). For an ad hoc
  backup before a risky manual operation, `pg_dump` against `DIRECT_URL`.
- **Restoring:** via the Supabase dashboard's point-in-time-recovery /
  backup restore UI (project-specific — check what the current plan
  supports). There is no app-level restore tooling.
- **Running a migration on production:** **never routine.** Per the root
  `CLAUDE.md`'s migration rule: `prisma migrate dev` locally against the
  dev database first, verify on a Preview deployment (which shares the
  dev database), and only then run `prisma migrate deploy` against
  production — manually, deliberately, by a human watching it happen.
  Never `db push`/`db reset` against anything but dev — both are guarded
  by `scripts/check-db-safety.mjs`, which refuses to run against any
  database ref not on its explicit allow-list (currently only the dev
  ref exists; the prod ref will never be added to that list, by design).
- **Never run against production:**
  - `pnpm db:reset` / `pnpm db:push` — blocked by the safety script
    already, but don't try to work around it.
  - Any raw `DELETE`/`UPDATE` without a `WHERE` clause scoped to a
    specific, verified set of IDs.
  - `prisma migrate dev` (creates a new migration interactively against
    whatever `DATABASE_URL` is currently loaded — always confirm which
    database that env points at first).
  - Anything copy-pasted from a dev debugging session without re-reading
    it against the production schema first.

## 6. Incident response

No formal severity/on-call system exists yet (matches the "no Sentry, no
uptime monitor" gap noted at the top of this document) — the below is the
intended shape for when one does.

- **Severity levels** (suggested, not yet codified anywhere else):
  - **SEV1** — the app is down or data is being corrupted/exposed. Act
    immediately, no queue.
  - **SEV2** — a major feature is broken for many users (e.g., booking
    creation failing, payments not processing) but the app is otherwise up.
  - **SEV3** — a minor feature is broken or degraded for some users.
- **Who to notify:** whoever currently holds on-call/ops responsibility —
  not yet formalized; today this is "whoever is available," which is
  itself worth fixing before real users depend on this.
- **Maintenance mode:** no built-in maintenance-mode toggle exists. The
  fastest lever available today is a Vercel deployment rollback (below)
  or pausing traffic at the DNS/Vercel level manually.
- **Rolling back a deployment:** Vercel dashboard → Deployments → find the
  last known-good deployment → Promote to Production (or `vercel
  rollback` via the CLI). This only reverts application code — it does
  **not** revert a database migration. If the incident involves a bad
  migration, code rollback alone won't fix it; you'd need a forward-fix
  migration (see §5) since Prisma migrations aren't designed to be rolled
  back automatically.
- **Post-incident template** (suggested):
  - What happened, in one sentence.
  - Timeline (detected at, mitigated at, resolved at).
  - Root cause.
  - What limited the blast radius (or didn't).
  - Action items, each with an owner.

## 7. Monitoring

**As of this writing, no alerting is configured** (no Sentry project, no
uptime monitor — see the note at the top of this document). Until that
exists, the closest thing to monitoring is:

- Vercel's own deployment/runtime logs (Vercel dashboard → your project →
  Logs) — shows unhandled errors and request-level failures, but nothing
  proactively pages anyone.
- The `/admin` overview dashboard's `failedPayments`/`pendingReports`
  counts, checked manually per the daily checklist (§1).

When Sentry and an uptime monitor are added (Phase 12 Step 8's remaining
work), this section should be rewritten with: every alert configured,
what triggers it, and the first three things to check when it fires —
that structure can't be written accurately before the tooling exists.

## 8. Support playbook

Ten most likely questions, with a suggested reply in Vietnamese and
English. Adjust names/details/dates per the actual situation before
sending.

**1. Payment failed / thanh toán thất bại**
- EN: "Your card was declined. Your profile stays fully active until
  [date] — update your payment method from Settings → Billing before then
  to avoid any interruption."
- VI: "Thẻ của bạn bị từ chối. Hồ sơ của bạn vẫn hoạt động bình thường đến
  hết ngày [ngày] — vui lòng cập nhật phương thức thanh toán trong Cài
  đặt → Thanh toán trước thời hạn đó để không bị gián đoạn."

**2. Can't upload / không tải lên được**
- EN: "Can you tell me what happens when you try — an error message, or
  does it just not respond? Uploads go through Cloudinary; if the issue
  is on our end we'll need to check the upload signature endpoint."
- VI: "Bạn có thể cho mình biết cụ thể chuyện gì xảy ra khi tải lên không
  — có thông báo lỗi hay chỉ đơn giản không phản hồi? Ảnh/video được tải
  qua Cloudinary; nếu lỗi từ hệ thống, mình sẽ kiểm tra phần cấp quyền
  tải lên."

**3. Booking not showing / không thấy lịch đặt**
- EN: "Booking requests appear under Dashboard → Bookings for both sides.
  Can you confirm which account you're checking from — the one that sent
  the request, or the one that should receive it?"
- VI: "Yêu cầu đặt lịch hiển thị ở Dashboard → Lịch đặt cho cả hai bên.
  Bạn có thể xác nhận đang kiểm tra từ tài khoản nào không — bên gửi yêu
  cầu hay bên nhận?"

**4. How to cancel (subscription) / cách hủy gói**
- EN: "Go to Settings → Billing → Manage plan — that opens Stripe's
  billing portal where you can cancel. You'll keep full access until the
  end of your current billing period."
- VI: "Vào Cài đặt → Thanh toán → Quản lý gói — hệ thống sẽ mở cổng thanh
  toán của Stripe để bạn hủy. Bạn vẫn được sử dụng đầy đủ tính năng đến
  hết chu kỳ thanh toán hiện tại."

**5. How to change role / cách đổi/thêm vai trò**
- EN: "Go to Settings → Roles — you can add a new paid role there anytime
  (it starts its own 14-day trial). Multiple roles can be active at once."
- VI: "Vào Cài đặt → Vai trò — bạn có thể thêm vai trò trả phí mới bất cứ
  lúc nào (sẽ có 14 ngày dùng thử riêng). Bạn có thể giữ nhiều vai trò
  cùng lúc."

**6. Forgot password / quên mật khẩu**
- EN: "Use the 'Forgot password?' link on the sign-in page — you'll get
  an email with a reset link valid for 1 hour. Check spam if it doesn't
  arrive within a few minutes."
- VI: "Bấm vào 'Quên mật khẩu?' ở trang đăng nhập — bạn sẽ nhận được email
  chứa link đặt lại mật khẩu, có hiệu lực trong 1 giờ. Nếu không thấy
  email sau vài phút, hãy kiểm tra thư mục spam."

**7. Profile not appearing in search / hồ sơ không hiện trong tìm kiếm**
- EN: "A few things affect this: your profile must be published, your
  subscription must be active (not expired/cancelled), and search
  filters must match your role/city/price range. Can you confirm your
  subscription status from Settings → Billing?"
- VI: "Có vài yếu tố ảnh hưởng: hồ sơ phải ở trạng thái xuất bản, gói đăng
  ký phải còn hiệu lực (không hết hạn/đã hủy), và bộ lọc tìm kiếm phải
  khớp với vai trò/thành phố/mức giá của bạn. Bạn có thể kiểm tra trạng
  thái gói đăng ký ở Cài đặt → Thanh toán giúp mình không?"

**8. Refund request / yêu cầu hoàn tiền**
- EN: "Can you tell me what this charge was for — a subscription or a
  marketplace order? That determines the right refund path." (See §4 for
  the actual procedure once you know which.)
- VI: "Bạn cho mình biết khoản phí này là cho gói đăng ký hay đơn hàng
  trên marketplace? Mình cần biết để xử lý hoàn tiền đúng quy trình."

**9. Report a user / báo cáo người dùng**
- EN: "You can report any profile directly — there's a flag icon next to
  Follow/Save on their profile page, or a Report option in any
  conversation. Our team reviews every report, with anything involving
  safety concerns prioritized."
- VI: "Bạn có thể báo cáo bất kỳ hồ sơ nào trực tiếp — có biểu tượng cờ
  cạnh nút Theo dõi/Lưu trên trang hồ sơ, hoặc mục Báo cáo trong bất kỳ
  cuộc trò chuyện nào. Đội ngũ của chúng tôi xem xét mọi báo cáo, ưu tiên
  các trường hợp liên quan đến an toàn."

**10. Delete my account / xóa tài khoản**
- EN: "I can process that for you — can you confirm the email on the
  account? Note: this deactivates your account and removes it from
  search/public view; some data is retained per our data policy." (See
  §2's deletion-request caveats before promising full erasure.)
- VI: "Mình có thể xử lý yêu cầu này — bạn xác nhận giúp mình email của
  tài khoản nhé? Lưu ý: thao tác này sẽ vô hiệu hóa tài khoản và gỡ khỏi
  tìm kiếm/hiển thị công khai; một số dữ liệu vẫn được lưu giữ theo chính
  sách dữ liệu của chúng tôi."

## 9. Recurring tasks

- **Weekly:** clear the moderation queue backlog to zero (even
  low-priority items); skim `/admin` overview for anything trending
  wrong (rising `PAST_DUE` count, falling completion rate).
- **Monthly:** review MRR trend (`/admin` overview's `mrr` figure — note
  it's a simple sum of active subscriptions' flat monthly price, not
  amortized for yearly subs, so treat it as directional, not exact);
  spot-check a handful of newly-published profiles for guideline
  compliance, especially Model profiles given the safety stakes.
- **Quarterly:** re-read `docs/ARCHITECTURE.md`'s technical-debt section
  and `docs/DEVELOPMENT.md`'s technical-debt register (once written) and
  confirm nothing there has become urgent; review whether any "not yet
  implemented" item in this document (Sentry, uptime monitoring, the
  suspension enforcement gap in §2, the ID-verification launch decision
  in §2) still needs a decision.
