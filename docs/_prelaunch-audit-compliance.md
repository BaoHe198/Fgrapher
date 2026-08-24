# Pre-Launch Audit — Compliance & Constraint Enforcement

Scope: this file covers (1) enforcement of the 10 numbered "Ràng buộc bắt buộc"
constraints in CLAUDE.md, and (2) a leak audit of 5 sensitive data types across
public/authenticated API routes and metadata generation. Read-only audit — no
files other than this one were changed. Every finding below was verified by
reading the actual source; where verification wasn't possible in the time
available, that's stated explicitly rather than assumed clean.

---

## Part 1 — CLAUDE.md Constraint Enforcement

### 1. Stripe unusable — no new Stripe code, existing code behind `BILLING_ENABLED`

**Severity: Info (well enforced).**

- Flag defined `src/lib/env.ts:65` (`BILLING_ENABLED: booleanFlag("false")`),
  re-exported `src/lib/features.ts:14`.
- All 6 Stripe-touching routes gate on `features.billingEnabled` and return
  404 (not 500 — deliberately, per code comments) before ever calling into
  `src/lib/stripe.ts`:
  - `src/app/api/stripe/checkout/route.ts:19`
  - `src/app/api/stripe/cancel/route.ts:13`
  - `src/app/api/stripe/portal/route.ts:13`
  - `src/app/api/stripe/invoices/route.ts:10`
  - `src/app/api/stripe/resume/route.ts:13`
  - `src/app/api/webhooks/stripe/route.ts:23`
- `src/lib/stripe.ts:16-19` additionally no-ops when `STRIPE_SECRET_KEY` is
  unset, a second layer of defense.
- No other payment gateway code found (searched for momo/vnpay/zalopay/
  paypal/payos/onepay/napas — zero matches in `src/`).
- Verified each gate independently by grepping the first ~20 lines of each
  route file for the `billingEnabled` check and its `404` response — all 6
  confirmed, not just asserted.

### 2. No online payment gateway; subscription assigned manually via admin

**Severity: Info (well enforced).**

- `src/services/subscription.ts:353-385` (`assignManualPlan`) upserts a
  `UserRole` + `Subscription` with `status: "ACTIVE"` and no
  `stripeCustomerId`/`stripeSubscriptionId` — the manual path.
- Called from `src/app/api/admin/users/[id]/route.ts` (admin-only, behind
  `requireAdmin()`) and from `assignFreePlan` (`src/services/subscription.ts:394`),
  invoked at registration time when billing is disabled
  (`src/app/api/auth/register/route.ts:134-138`).
- No other payment gateway integration exists anywhere in `src/`.

### 3. No nude/sexy/boudoir category, not in `ProfileCategory`

**Severity: Info (enforced) / Low (one ambiguous label worth a human look).**

- `prisma/schema.prisma:439-476` — full `ProfileCategory` enum read in full;
  no nude/sexy/boudoir/adult-content entries. Categories are style-based
  (WEDDING, PORTRAIT, FASHION, BRIDAL, etc.) and model-type-based
  (FASHION_MODEL, PLUS_SIZE, PETITE, MATURE, **ALTERNATIVE**).
- Repo-wide search for `nude|khoả thân|sexy|boudoir|nội dung người lớn`
  across `src/` and `prisma/` returned zero real matches (only an unrelated
  `menuDescription` string).
- `ALTERNATIVE` (schema line 475, label "Alternative" at
  `src/lib/constants/index.ts:163`) is a legitimate modeling-industry term
  (alt/goth/tattoo aesthetic) but is vague enough that a legal reviewer
  should confirm it isn't read as a euphemism — flagging for human
  judgment, not asserting a violation.

### 4. Every account 18+, every role

**Severity: Critical — confirmed bypass for OAuth signups.**

- Credentials-based registration is properly enforced **server-side**, not
  just client-side: `src/lib/validations/auth.ts:75-77` and `:122-124` both
  `.refine((data) => isAtLeast18(new Date(data.dateOfBirth)), ...)` inside
  `registerSchema`, and `src/app/api/auth/register/route.ts:16`
  (`registerSchema.safeParse(body)`) rejects with 400 before any DB write —
  confirmed this is the actual gate, not just a client-side form check.
  `src/lib/age-gate.ts` implements `isAtLeast18`/`calculateAge` cleanly.
- **However**: Google OAuth signup (`src/lib/auth.ts:23-26`, via
  `PrismaAdapter(db)`) creates a `User` row with **no `dateOfBirth` field at
  all** — the adapter's `createUser` only receives what Google's OAuth
  profile provides (name/email/image), and `dateOfBirth` is nullable in the
  schema (`prisma/schema.prisma:49`, `DateTime?`). I traced every write site
  for `dateOfBirth` in the codebase (`grep -rl dateOfBirth src/app src/services src/lib`)
  and the **only** place it is ever set is
  `src/app/api/auth/register/route.ts:82` (the credentials-only registration
  route). There is no onboarding step, settings page, or API route that lets
  a user set/backfill `dateOfBirth` after OAuth signup — I checked
  `src/app/onboarding/roles/page.tsx`, `src/app/onboarding/verification/*`,
  and `src/app/api/users/me/route.ts` / `src/lib/validations/user.ts`
  specifically for a DOB field; none exists.
  - **Net effect: a Google OAuth account can be created and used at any age,
    with zero enforcement of the 18+ rule anywhere in the code.** This is
    exactly the "UI/one code path enforces it, a second entry point doesn't"
    failure mode the audit was asked to hunt for — except here it's not
    even a UI-vs-API gap, it's a whole second account-creation path with no
    equivalent check at all.
  - `getAgeRangeLabel()` (used on public profiles, `src/app/(public)/profile/[username]/page.tsx:107-110`)
    degrades gracefully to showing nothing when `dateOfBirth` is null, so
    this doesn't visibly break anything — which is likely why it wasn't
    caught before.

### 5. Provider identity verification required before public profile, every provider role

**Severity: Info (well enforced) — actively tried to break it, couldn't.**

- Single write path for `Profile.isPublished`:
  `src/services/public-profile.ts:16-57` (`setProfilePublished`). Comment at
  lines 10-15 explicitly documents this is meant to be the only path.
  Throws `ProfileNotVerifiedError` unless `UserRole.verificationStatus ===
"VERIFIED"` (lines 21-29), applies to **every** role (not MODEL-specific —
  the function takes a generic `Role` param), and also requires at least
  one `APPROVED` portfolio media item (lines 41-50, `ProfileHasNoApprovedMediaError`)
  — this doubles as evidence for constraint #8.
- **Actually tried to bypass it**: read
  `src/app/api/profiles/[role]/route.ts`'s `PATCH` handler (the general
  profile-edit endpoint, separate from the publish endpoint) to see if a
  client could sneak `isPublished: true` through the general update body.
  It calls `db.profile.upsert({ ..., update: parsed.data })` where
  `parsed.data` comes from `updateProfileSchema`
  (`src/lib/validations/profile.ts:13-36`) — read that schema fully:
  **`isPublished` is not a field in it**, so Zod strips it silently even if
  a malicious client includes it in the request body. Confirmed no bypass.
- Also checked for any other direct `db.profile.update`/`updateMany` call
  that sets `isPublished: true` elsewhere — the only other write is
  `src/services/subscription.ts:322` (`updateMany({ data: { isPublished:
false } })`, subscription-expiry unpublish), which only ever sets it
  `false`, never `true`. No other write path exists.
- The publish route itself
  (`src/app/api/profiles/[role]/publish/route.ts:45-49`) calls
  `setProfilePublished` and correctly maps its thrown errors to 403/404 —
  confirmed by reading the full file.
- Search/listing surfaces (`src/services/search.ts:246`,
  `src/services/public-profile.ts:64,98`) all filter on `isPublished: true`
  only, trusting that flag — which is safe _because_ of the single-write-path
  guarantee above, not because they independently re-check verification.

### 6. Per-purpose consent, timestamped, policy version, IP, no bundled/pre-checked boxes

**Severity: Info (enforced for credentials signup) / High (same OAuth gap as #4).**

- `ConsentPurpose` enum has 4 distinct values, each a separate DB row per
  grant/revoke event (`prisma/schema.prisma:196-225`,
  `src/services/compliance.ts:15-41` `recordConsent` always `create`s a new
  row, never updates in place — full history preserved).
- `src/app/api/auth/register/route.ts:107-130` fires 3 separate
  `recordConsent` calls (SERVICE/MARKETING/ANALYTICS) with `policyVersion`,
  `ipAddress`, `userAgent` each — comment at lines 102-105 confirms this is
  deliberate, including recording declines, not just grants.
  `src/services/verification.ts:76-83` records a 4th purpose
  (`IDENTITY_VERIFICATION`) at KYC submission time.
- UI: `src/app/(auth)/register/register-form.tsx:97-99` defaults all three
  consent checkboxes to `false` (`consentService/Marketing/Analytics: false`),
  and they're 3 visually separate `Checkbox` components (lines 350-377), not
  one bundled control. Confirmed not pre-checked.
- **Same OAuth gap as constraint #4**: Google OAuth signups never hit
  `/api/auth/register`, so **no ConsentRecord rows are ever created** for
  those users — no SERVICE consent, no MARKETING/ANALYTICS opt-in record,
  nothing. There is no consent-collection step anywhere in the OAuth flow
  (`src/lib/auth.ts`'s `signIn`/`jwt`/`session` callbacks do nothing of the
  kind). This means OAuth users are using the service with zero recorded
  legal basis for processing their data — a real gap given constraint #6's
  own emphasis on evidence, not just a checkbox model.

### 7. KYC images non-public storage, every access logged, 90-day auto-delete

**Severity: Info (storage/audit correct) / Medium (purge has a gap on rejected submissions).**

- Storage: `src/lib/cloudinary.ts:61-98` — KYC assets uploaded with
  Cloudinary delivery `type: "authenticated"` into a dedicated
  `fgrapher-kyc/<userId>` folder, `type` is part of the signed upload
  params (so a client can't request public delivery instead), never given
  a public URL. Confirmed distinct from the portfolio upload path
  (`fgrapher/portfolio/...`).
- Access logging: `src/services/admin.ts:375-403` (`getKycImageUrl`) mints a
  5-minute signed URL (`generateKycSignedUrl`) and **always** calls
  `logAudit({ action: "VIEW_KYC_DOCUMENT", ... })` before returning it — the
  only route that calls this is
  `src/app/api/admin/verifications/[id]/image/route.ts`, gated by
  `requireAdmin()` (line 16). Grepped the whole repo for
  `verificationIdUrl|verificationIdBackUrl|verificationSelfieUrl` outside
  `services/admin.ts`/`services/verification.ts`/the schema — zero other
  reads, so this is confirmed as the only way to view a KYC image.
- Auto-delete: `src/services/verification.ts:100-153`
  (`purgeExpiredKycDocuments`, run by
  `src/app/api/cron/purge-kyc-documents`) deletes the 3 Cloudinary assets
  and nulls the URL/publicId columns once `UserRole.purgeAfter < now`.
  - **Gap found**: `purgeAfter` is only ever set on the **approval** branch
    of `reviewVerification` (`src/services/admin.ts:329-347`,
    `approve ? { ..., purgeAfter: new Date(Date.now() + 90d) } : {
verificationStatus: "REJECTED", ... }` — the `else` branch sets no
    `purgeAfter`). Read this function fully to confirm: a **rejected**
    verification, or one an admin never reviews at all (stuck `PENDING`),
    never gets a `purgeAfter` value and its KYC images (front/back ID +
    selfie) are **never auto-deleted** — they sit indefinitely until an
    admin manually approves or some other process touches them. This
    contradicts the "auto-delete after 90 days" requirement for the
    non-approved-but-still-uploaded case, which is arguably the more
    privacy-sensitive one (a rejected/abandoned ID scan with no ongoing
    business reason to exist).

### 8. Portfolio images moderated before public display

**Severity: Info (enforced, multi-layered).**

- `setProfilePublished` (see #5) requires at least one `APPROVED`
  `ProfileMedia` row before allowing publish at all
  (`src/services/public-profile.ts:41-50`).
- Independently, every public read of media also filters
  `moderationStatus: "APPROVED"`:
  `src/services/public-profile.ts:69-71` (public profile page),
  `src/services/search.ts:45-48` (search results,
  `PROVIDER_INCLUDE.media.where`). Comments at both sites cross-reference
  each other ("same rule as ..."), suggesting this was deliberately
  double-enforced rather than relying on the publish-time check alone —
  good defense in depth, since a profile could stay `isPublished: true`
  after its only approved photo is later un-approved.
- Did not have time to verify the moderation-status transition logic itself
  (i.e., whether a non-admin route could ever set `moderationStatus:
"APPROVED"` directly) — worth a follow-up grep on writes to
  `ProfileMedia.moderationStatus` if this hasn't been covered by another
  agent's report.

### 9. No hardcoded province/city list in code or components

**Severity: Medium — one confirmed violation.**

- The app has a real `Province`/`Ward` DB-backed geography system
  (`prisma/schema.prisma:115-140`, `src/services/geography.ts`,
  `src/app/api/geography/wards/route.ts`), and
  `src/app/(dashboard)/dashboard/settings/profile/account-basics-form.tsx`
  correctly consumes it dynamically.
- **However**, `src/components/browse/filter-sidebar.tsx:29-38` defines:
  ```ts
  const CITIES = [
    "Hồ Chí Minh",
    "Hà Nội",
    "Đà Nẵng",
    "Nha Trang",
    "Hội An",
    "Đà Lạt",
    "Cần Thơ",
    "Hải Phòng",
  ];
  ```
  and it's not dead code — it's spread into the city filter's `<select>`
  options at line 389 (`...CITIES.map((c) => ({ value: c, label: c }))`).
  This is a hardcoded 8-city subset of Vietnam's 63 provinces, used on the
  main browse/search filter UI, directly contradicting constraint #9 (and
  it's inconsistent with the profile-edit form on the very same feature
  set, which does this correctly). Confirmed by reading the full component
  file and confirming the `CITIES` constant's only usage site.

### 10. Entire UI in Vietnamese; VND "1.500.000₫"; dates dd/MM/yyyy; Asia/Ho_Chi_Minh

**Severity: High — two separate, widespread violations found.**

- **Currency/date formatting has one correct source of truth that's
  routinely bypassed.** `src/lib/format.ts` is explicit about being the
  single source (comment at top: "không dùng toLocaleString()/
  toLocaleDateString() trực tiếp ở nơi khác") and correctly implements
  `formatVND` (`"1.500.000₫"`, line 15-17), `formatDate` (dd/MM/yyyy,
  `vi-VN` + `Asia/Ho_Chi_Minh`, lines 20-27), `formatDateTime`, `formatTime`.
  But a repo-wide grep for `toLocaleDateString|toLocaleTimeString|
toLocaleString` outside that file found **21 files** calling these
  browser/runtime-locale-dependent methods directly, almost all hardcoded
  to `"en-US"` (producing English month names / MM/DD/YYYY-style output,
  and in several cases no explicit `Asia/Ho_Chi_Minh` timeZone, meaning the
  server/browser's local timezone applies instead):
  `src/app/(public)/booking/[providerId]/booking-wizard.tsx` (5 call sites),
  `src/app/(public)/profile/[username]/reviews-tab.tsx`,
  `src/app/(dashboard)/saved/page.tsx` (also bypasses `formatVND` — raw
  `.toLocaleString()` on a price at line 60),
  `src/app/(dashboard)/dashboard/calendar/page.tsx`,
  `src/app/(dashboard)/dashboard/bookings/page.tsx`,
  `src/app/(dashboard)/dashboard/bookings/[id]/page.tsx` (3 sites),
  `src/app/(dashboard)/dashboard/shop-orders/shop-orders-content.tsx`,
  `src/app/(dashboard)/dashboard/orders/customer-orders-content.tsx`,
  `src/app/(dashboard)/dashboard/orders/[id]/order-detail-content.tsx` (2 sites),
  `src/app/(dashboard)/dashboard/reviews/reviews-dashboard-content.tsx`,
  `src/app/(admin)/admin/page.tsx`,
  `src/app/(admin)/admin/compliance/page.tsx` (3 sites),
  `src/app/(admin)/admin/users/page.tsx`,
  `src/app/(admin)/admin/users/[id]/page.tsx`,
  `src/app/(admin)/admin/reports/page.tsx`,
  `src/components/ui/calendar.tsx`,
  `src/components/chat/conversation-list.tsx`,
  `src/components/chat/chat-panel.tsx` (2 sites),
  `src/components/profile/booking-sidebar.tsx` (2 sites),
  `src/components/cart/cart-item-row.tsx` (2 sites),
  `src/services/bookings.ts:76` (`dateLabel`, used in booking-confirmation
  emails — so this leaks into user-facing email copy too, not just UI).
  This is a large, mechanical fix (swap each call for `formatDate`/
  `formatDateTime`/`formatTime` from `src/lib/format.ts`) but it's
  currently violating the constraint on every booking, order, review,
  chat, and admin screen that shows a date.

- **Category/role/experience-level labels are hardcoded English, not
  translated.** `src/lib/constants/index.ts` defines `ROLE_LABELS`,
  `CATEGORY_LABELS` (lines 129-164), and `EXPERIENCE_LEVEL_LABELS` as plain
  English string maps (`WEDDING: "Wedding"`, `MATURE: "Mature"`, etc.) —
  not routed through `next-intl`'s `useTranslations`/`getTranslations`.
  Confirmed these are actually rendered raw (not overridden by a `t()` call
  downstream) at `src/components/browse/filter-sidebar.tsx:284,303,346`
  (role/category/experience-level filter option labels) despite a
  misleading comment two lines above the `CITIES` constant claiming
  "Labels for these three option lists are resolved inside the component
  via useTranslations" — that's not what the code at lines 284-346 does. 20
  files repo-wide import from these label maps, including the landing page
  (`src/app/(public)/page.tsx`), browse/search
  (`src/app/(public)/browse/page.tsx`), public profile
  (`src/app/(public)/profile/[username]/page.tsx`), registration form,
  dashboard settings/portfolio/billing, onboarding, and admin user
  management — meaning role names ("Photographer"), categories
  ("Wedding", "Bridal"), and experience levels ("Professional") show in
  English throughout the product regardless of the `vi` locale being active
  everywhere else on the same page.

- Locale routing itself is fine: `src/i18n/routing.ts` sets `defaultLocale:
"vi"` with a comment explicitly citing this constraint, and offers `en`
  as an optional secondary locale via cookie — this reads as a reasonable
  interpretation of "toàn bộ giao diện tiếng Việt" (default/primary
  language is Vietnamese) rather than a violation, but flagging for the
  human reviewer since the literal text could be read either way, and
  either way the two findings above mean the "vi" experience itself is not
  actually fully Vietnamese today.

---

## Part 2 — Sensitive Data Leaks

Legend: for each of the 5 fields, routes checked and outcome.

### `phone`

**Confirmed not leaked to unauthenticated/non-party viewers**, with one
consistency gap noted below (not a leak to strangers, but a gap in an
in-app safety gate).

- Public profile (`src/services/public-profile.ts:59-87`,
  `getPublicProfileUser`) and search
  (`src/services/search.ts:36-48`, `PROVIDER_INCLUDE.user.select`) both use
  **explicit field allowlists that omit `phone`** entirely for the `user`
  relation. Confirmed by reading both select blocks in full — no wildcard
  `include` on the `User` sub-relation in either case (contrast with the
  top-level query issue noted under `email`/`dateOfBirth` below).
- Booking's `contactPhone` field (booking-specific contact number, distinct
  from `User.phone`) is correctly gated in the **detail** endpoint:
  `src/services/bookings.ts:216-247` (`getBookingDetail`) nulls it out
  unless `contactInfoVisible` — the provider only sees the customer's
  `contactPhone` after accepting (booking status not `PENDING`), never
  while pending; the customer always sees their own. Non-parties get `null`
  from the function entirely (party check at lines 214-217) → route returns
  404 (`src/app/api/bookings/[id]/route.ts`).
  - **Gap found (traced deliberately)**: the same `contactPhone` field is
    **not** redacted in the two sibling endpoints that read the same
    `Booking` rows — `listBookings` (`src/app/api/bookings/route.ts` GET,
    backing the dashboard bookings list) and `listBookingsForRange`
    (`src/app/api/bookings/calendar/route.ts`, backing the dashboard
    calendar). Both use `BOOKING_INCLUDE`
    (`src/services/bookings.ts:50-70`), which — because it's a top-level
    `include` with no top-level `select` on `Booking` — returns every
    scalar column on the `Booking` row unfiltered, including
    `contactPhone` and `locationAddress`, regardless of booking status.
    Party-scoping is correct here (`where: { providerId: userId }` /
    `{ customerId: userId }`, `src/services/bookings.ts:96`), so this isn't
    exposed to strangers — but it **is** a real, verified inconsistency: a
    provider can see a PENDING booking's customer phone/address through the
    list or calendar view, even though the detail view for that exact same
    booking would redact it. This is exactly the "one route enforces the
    rule, a sibling route touching the same data doesn't" pattern — found
    by deliberately re-reading `BOOKING_INCLUDE` against the
    `contactInfoVisible` logic in `getBookingDetail` and confirming neither
    `listBookings` nor `listBookingsForRange` calls anything equivalent.
- No `phone` field found in `generateMetadata`/JSON-LD anywhere (see the
  `email`/`dateOfBirth` section below for the full metadata check, which
  covered `phone` too).

### `dateOfBirth`

**Confirmed not leaked as a raw value**, one architectural risk flagged.

- Public profile page never renders `user.dateOfBirth` directly — the only
  use is `getAgeRangeLabel(user.dateOfBirth)`
  (`src/app/(public)/profile/[username]/page.tsx:107-110`), which buckets
  into `"18–24"`/`"25–34"`/etc. (`src/lib/age-gate.ts:19-25`), and only for
  `MODEL` role profiles. Comment at page.tsx:105-106 explicitly documents
  this constraint.
- **Architectural risk, not an active leak**: `getPublicProfileUser`
  (`src/services/public-profile.ts:59-77`) queries
  `db.user.findUnique({ where: {...}, include: {...} })` with **no
  top-level `select`** — Prisma's behavior in this shape is to return
  _every_ scalar column on `User`, including `dateOfBirth`, `phone`,
  `email`, and **`passwordHash`**. I confirmed this is the actual query
  shape by reading the full function. Today this is safe because the
  calling Server Component
  (`src/app/(public)/profile/[username]/page.tsx`) only ever destructures
  specific safe fields (`location`, `avatar`, `coverImage`, `name`,
  `acceptingBookings`, `id`, and `dateOfBirth` only via the bucketing
  function) when rendering HTML or passing props to Client Components
  (`ProfileActions`, `ProfileInteractive` — checked both prop lists at
  lines 252-258 and 282-297, neither receives the raw `user` object). But
  since Next.js Server Components serialize whatever's passed as props to
  a Client Component into the page payload, **one future edit that spreads
  `user` (or `{...user}`) into a Client Component prop would silently leak
  `phone`/`email`/`dateOfBirth`/`passwordHash` to every visitor of that
  profile** — the query itself isn't defense-in-depth, only the current
  call site's careful destructuring is. Recommend adding an explicit
  `select` to `getPublicProfileUser` regardless of current safety.
- Not found in any `generateMetadata`/JSON-LD block — see full check below.

### `locationAddress` (booking field)

**Confirmed gated correctly in the detail endpoint; same list/calendar gap
as `phone` above** (it's the same `BOOKING_INCLUDE`/`contactInfoVisible`
mechanism — see the `phone` section for the full trace). Not re-derived
here to avoid duplication, but flagging again because it's explicitly one
of the 5 fields the audit asked about: `src/services/bookings.ts:245-246`
redacts it in `getBookingDetail` only; `listBookings`/`listBookingsForRange`
don't apply the same redaction.

### KYC/identity-verification document images

**Confirmed not leaked** — this is the constraint the codebase treats most
carefully (see Part 1 #7 for the full trace of storage/signing/audit-log).
Summary for this section:

- Never given a public Cloudinary URL (delivery `type: "authenticated"`,
  `src/lib/cloudinary.ts:77`).
- The only route that can produce a viewable URL is
  `src/app/api/admin/verifications/[id]/image/route.ts`, behind
  `requireAdmin()`, and every call is audit-logged
  (`src/services/admin.ts:396-403`).
- Grepped every file for the raw column names
  (`verificationIdUrl|verificationIdBackUrl|verificationSelfieUrl`) — the
  only reads are inside `services/admin.ts` (the audited signed-URL path)
  and `services/verification.ts` (the purge job, which reads them only to
  pass to `deleteKycAsset`, never returns them). The admin verification
  **list** endpoint (`listPendingVerifications`,
  `src/services/admin.ts:305-320`) explicitly selects only
  `{ id, name, firstName, email, avatar, dateOfBirth }` for the user side —
  no image URLs in the list view, only in the single-image detail fetch.
  Confirmed no public or non-admin route touches these columns at all.

### `email`

**Confirmed not leaked via public profile/search or metadata; one
in-app-but-cross-context exposure noted.**

- Public profile (`getPublicProfileUser`) and search
  (`PROVIDER_INCLUDE.user.select`) both omit `email` from their explicit
  selects where one exists (search) — profile's top-level query has the
  same unfiltered-`include` risk noted under `dateOfBirth` above (same
  finding, not repeated).
- `src/app/sitemap.ts` — read in full: only selects `updatedAt` and
  `user.username` for profile entries, `id`/`updatedAt` for products. No
  PII of any kind.
- `src/app/robots.ts` — read in full: static rules only, disallows
  `/dashboard`, `/api`, `/checkout`, `/onboarding`, `/cart`. No PII. Minor
  observation (not one of the 10 constraints, noting anyway): `/admin` is
  **not** in the disallow list, so admin routes could technically get
  crawled/indexed (the pages themselves require auth to show content, so
  this isn't a data leak, just an avoidable index-bloat/info-disclosure-of-
  existence issue) — Low severity, worth a one-line fix.
- Checked every `generateMetadata` export in the app (9 files:
  booking/[providerId], shop/[productId], profile/[username], browse,
  pricing, forgot-password, reset-password, login, admin). None reference
  `email`, `phone`, `dateOfBirth`, `locationAddress`, or any verification
  field. `profile/[username]/page.tsx`'s `generateMetadata`
  (lines 50-73) and its JSON-LD block (lines 154-172) only use
  `displayName`, `bio`/`description`, `user.location` (city-level, the
  same field shown publicly on the page itself, not a precise address),
  and `user.coverImage` — no PII beyond what's already intentionally
  public.
- **Cross-context exposure, not a stranger-facing leak**: `BOOKING_INCLUDE`
  (`src/services/bookings.ts:50-68`, used by the bookings list and
  calendar endpoints discussed under `phone` above) explicitly selects
  `customer.email` and `provider.email` and returns them to the other
  party. Since both parties are legitimate participants in their own
  bookings (party-scoped `where` clause confirmed), this isn't a leak to
  the public — but it does mean a **customer's email address is shown
  directly to a provider they've merely requested a booking with (even
  while still `PENDING`, unlike phone/address which at least get
  redacted for that state)**, and vice versa. Whether that's intended
  (email as a lower-sensitivity, always-available contact channel) or an
  oversight parallel to the phone/address gap is a product decision the
  team should confirm explicitly — flagging it because it wasn't clearly
  a deliberate choice the way the phone/address redaction obviously was
  (that one has a comment explaining the anti-spam reasoning; email has
  no equivalent comment either way).

---

## Coverage notes / what wasn't fully verified

- Did not verify the `moderationStatus` write path for `ProfileMedia` (who
  can set it to `APPROVED` — presumably admin-only, but not traced route by
  route in the time available). Flagged under constraint #8.
- Did not exhaustively check every admin route for field-level leaks beyond
  the ones directly relevant to the 5 tracked data types (verifications,
  users) — a full admin-surface PII audit was out of scope for the time
  spent here.
- Did not check e2e/test fixtures, seed data, or non-API rendering paths
  (e.g. server actions, if any exist outside `src/app/api`) for the same 5
  data types — this audit focused on `src/app/api/**/route.ts` plus the
  public profile/metadata/sitemap surfaces as the prompt specified.
- The `toLocaleDateString`/`toLocaleString` list under constraint #10 was
  gathered by grep and spot-checked (booking-wizard.tsx, saved/page.tsx,
  bookings.ts) but not all 21 files were individually opened — the pattern
  is consistent enough (`"en-US"` literal, no `Asia/Ho_Chi_Minh` timeZone)
  across the ones checked that I'm confident in the finding, but a couple
  of the 21 could theoretically have a mitigating wrapper I didn't spot.
