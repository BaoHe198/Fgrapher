# Pre-launch audit: Performance & Technical Debt

Scope: read-only audit of `src/services/**`, `src/app/**`, `src/components/**`,
and `prisma/schema.prisma`. Every finding below was verified by reading the
actual code (file:line), not just a grep hit. Nothing was edited.

## Part 1 — Performance

### 1.1 N+1 queries

**Finding A — `listConversations` (High)**
`src/services/messaging.ts:37-63`. Fetches a page of `ConversationParticipant`
rows (up to 20, `PAGE_SIZE`), then does:

```
participantRows.map(async (row) => {
  ...
  const unreadCount = await db.message.count({ where: { conversationId: row.conversationId, receiverId: userId, readAt: null } });
})
```

— one `db.message.count()` per conversation on every page load. This is the
conversations-list endpoint behind `/dashboard/messages`, which per
CLAUDE.md's "Current phase" notes is polled (not the individual chat panel,
but the list is loaded whenever that page is open). Should be a single
`db.message.groupBy({ by: ["conversationId"], where: { conversationId: { in: [...ids] }, receiverId: userId, readAt: null }, _count: true })` after the page of conversations is fetched, then joined in memory.

**Finding B — `getConsentStats` (Low)**
`src/services/admin.ts:565-593`. Loops a fixed 3-element array
(`CONSENT_PURPOSES`) and does one `db.consentRecord.findMany(...)` per
purpose inside `Promise.all`. Not a per-row N+1 (bounded at 3 iterations,
admin-only stats page, not a hot path) but could be one query using
`groupBy`/`distinct` across all purposes at once. Flagging as low-severity
since the bound is fixed and small.

**Finding C — `purgeExpiredKycDocuments` (Low / acceptable)**
`src/services/verification.ts:103-141`. `for (const row of due) { await
Promise.all([...cloudinary destroys]); await db.userRole.update(...) }` —
one DB update per row, sequential. This is a daily cron over what should be
a small row count (KYC docs due for 90-day purge), and the per-row Cloudinary
`destroy()` calls are an unavoidable external API constraint that already
forces per-row handling. The DB write, however, could be deferred and batched
into a single `updateMany({ where: { id: { in: [...succeededIds] } } })`
after all Cloudinary deletes settle, rather than one `update` per row. Minor;
not worth prioritizing before launch given the expected row volume.

**No other N+1 patterns found.** Checked and confirmed clean:
`src/services/search.ts` (stats computed via `db.review.groupBy`, role/city
facets via two batched `findMany`s, not per-row lookups),
`src/services/dashboard.ts` (all `Promise.all` branches are independent
queries, not per-item loops), `src/services/admin.ts`'s report list
(`admin.ts:273-296` — this is actually the _correct_ pattern: fetch reports,
collect distinct `reporterId`s, one batched `db.user.findMany({ where: { id:
{ in: reporterIds } } })`, join in memory — good precedent, worth pointing
new code at), `src/services/marketplace.ts`, `src/services/orders.ts`,
`src/services/public-profile.ts`, `src/services/bookings.ts`'s
`listBookings`/`getProviderStats`/`getCustomerStats`/`getRecentActivity`,
`src/services/availability.ts` (loops are pure in-memory computation over
already-fetched arrays, no DB calls inside). The `for` loops in
`bookings.ts:729-768` (`sendBookingReminders`) and `bookings.ts:778-793`
(`expireBookings`) are sequential cron jobs that call `transitionBooking`/
`notify` per row (business-logic side effects, not query fetches) — not an
N+1 in the query sense, but worth knowing they're O(n) sequential awaits if
the due-booking count ever gets large; not urgent pre-launch.

### 1.2 Missing database indexes

Cross-referenced `prisma/schema.prisma` against every migration's actual
`CREATE INDEX`/`CREATE UNIQUE INDEX` statements (confirmed Prisma+Postgres
does **not** auto-index foreign-key columns — only explicit `@@index`/
`@@unique` produce a DB index here) and against `where:` usage in
`src/services/**`.

- **`User.isSuspended` / `User.isVerified` / `User.deletedAt` (Medium)**
  No index on any of these. `admin.ts:45-46` runs `db.user.count({ where: {
deletedAt: null } })` and a suspended-count variant on every admin
  dashboard load (`getAdminOverview`), and `admin.ts:192` (`listUsers`) very
  likely filters/sorts by these in the admin user-management table (Phase
  12's stated feature: "search/filter" users). On a small seed dataset this
  is invisible; at real scale these become sequential scans. Recommend
  `@@index([deletedAt])` at minimum (covers the single most common filter),
  and consider `@@index([isSuspended])` if the admin user list filters by
  suspended state as advertised in the Phase 12 guide.

- **`Message.senderId` (Low)**
  `messages` has `@@index([conversationId, createdAt])` and
  `@@index([receiverId, readAt])` but nothing covering `senderId` alone. Not
  observed being queried directly in `src/services/**` today (conversation
  lookups go through `conversationId`), so this is speculative/low priority
  — flagging in case a "messages I sent" admin/moderation view gets added.

- **`Subscription.stripeCustomerId` (Low — dormant until Stripe is live)**
  Queried in `src/app/api/stripe/portal/route.ts:24-31` and
  `src/app/api/stripe/invoices/route.ts:28-35` via `db.subscription.findFirst
({ where: { userRole: { userId }, stripeCustomerId: { not: null } } })` —
  actually filtered through the `userRoleId` relation (which resolves via
  `UserRole`'s indexed `userId+role` unique), not a raw `stripeCustomerId`
  lookup, so this isn't a real gap today. Only matters if a future webhook
  handler ever looks up `Subscription` by `stripeCustomerId` directly (the
  reverse direction, "which user does this Stripe customer ID belong to") —
  worth an index at that point, not now. Moot anyway while
  `BILLING_ENABLED=false` per CLAUDE.md.

- **Everything else checked out.** `Booking` (customerId, providerId+status,
  date, parentBookingId, status+expiresAt — all present and match actual
  query shapes in `bookings.ts`), `Report` (status+createdAt,
  priority+status), `ProfileMedia` (profileId+order, moderationStatus+
  createdAt — matches the moderation queue's `orderBy: createdAt asc, where:
moderationStatus PENDING`), `UserRole` (verificationStatus+createdAt,
  matches the verification queue), `AuditLog`/`AdminAction`
  (actorId/adminId+createdAt, targetType+targetId), `DataRequest`
  (userId+type, status+requestedAt), `ConsentRecord` (userId+purpose),
  `Order` (customerId, shopId+status), `Product` (userId+isActive,
  category), `Review` (reviewedId+rating), `Notification`
  (userId+readAt+createdAt) — every one of these has an index that lines up
  with how it's actually queried in the services layer. `OrderItem` has no
  `@@index` at all (only implicit coverage via its own `id` PK), but the only
  reads are through the parent `Order`'s already-indexed relation
  (`order.items` via include) — not a standalone gap.

### 1.3 Image optimization

`next.config.ts:14-24` correctly allowlists `res.cloudinary.com` and
`lh3.googleusercontent.com` in `images.remotePatterns` — external images
_are_ set up to work with `next/image` when Cloudinary credentials land.

Four raw `<img>` tags found rendering remote/user-uploaded content instead of
`next/image`'s `<Image>` (each has a deliberate `// eslint-disable-next-line
@next/next/no-img-element` immediately above it, so these are intentional
opt-outs, not oversights — but each is still a missed-optimization instance
per the audit's remit):

- `src/app/(public)/profile/[username]/page.tsx:183` — public profile cover
  image (`user.coverImage`). This is a high-traffic public page; the most
  impactful of the four to fix.
- `src/app/(public)/profile/[username]/gear-tab.tsx:36` — product thumbnail
  in a public profile's gear tab.
- `src/app/(dashboard)/dashboard/listings/listings-list.tsx:146` — product
  thumbnail in the seller's own listings table.
- `src/app/(admin)/admin/moderation/page.tsx:230` — media thumbnail in the
  admin moderation queue grid.

Severity: **Medium** for the public profile cover image (public-facing,
high-traffic, largest image of the four); **Low** for the other three
(authenticated, lower-traffic, small thumbnails). None are broken — they'll
render correctly once Cloudinary is live — this is purely a missed
lazy-loading/responsive-srcset/format-conversion optimization, consistent
with the "worth double-checking image rendering... once real credentials
land" note already in CLAUDE.md's Phase 12 section.

---

## Part 2 — Technical Debt

### 2.1 `any` usage

**None found.** Broadened the grep beyond the literal pattern (`: any\b`,
`<any>`, `as any\b`, `any\[\]`, `Record<string, ?any>`, etc.) across all of
`src/`. The only two hits for the word "any" are both the plain English word
inside comments (`src/services/messaging.ts:210`, `src/services/bookings.ts:
777`), not TypeScript `any` usage. This codebase's "strict mode, no `any`"
rule (CLAUDE.md) appears to be genuinely holding — worth calling out as a
positive, not a gap.

### 2.2 Disabled lint rules

14 occurrences, two categories:

**`@next/next/no-img-element` (5 occurrences)** — all four raw `<img>` tags
from Part 1.3 above, each with the disable comment directly above the tag:
`profile/[username]/page.tsx:182`, `profile/[username]/gear-tab.tsx:35`,
`dashboard/listings/listings-list.tsx:145`,
`admin/moderation/page.tsx:229`. (Counted as 4 files; grep shows the comment
line itself once per site.) None carry an explanation of _why_ `next/image`
isn't used — the justification lives only implicitly (these are inside
small/dynamic grids where `next/image`'s fixed-dimension requirements are
more friction than benefit). Not urgent, but a one-line comment explaining
the tradeoff at each site would help the next person who touches these not
wonder if it's an oversight.

**`react-hooks/exhaustive-deps` (8 occurrences)** — none has an explanatory
comment beyond the bare disable directive:
`booking/[providerId]/booking-wizard.tsx:172`,
`dashboard/messages/page.tsx:65`,
`dashboard/bookings/[id]/page.tsx:133`,
`dashboard/orders/[id]/order-detail-content.tsx:83`,
`admin/compliance/page.tsx:89`, `admin/users/[id]/page.tsx:87`,
`admin/reports/page.tsx:60`, `components/chat/chat-panel.tsx:170`,
`components/modals/review-modal.tsx:60`. This is the single most common
disabled rule in the codebase (8 of 14 occurrences) and every instance is a
bare directive with zero justification — can't tell from the disable comment
alone whether each is a deliberate "run once on mount" pattern (likely, given
the file names — data-fetch-on-param-change effects) or a latent stale-
closure bug. Given the user's own memory note
(`feedback_effect_fetch_lint.md`: "wrap useEffect data-fetch calls in
startTransition to satisfy set-state-in-effect rule") shows there's an
established house pattern for effect-based fetches, it would be worth a
follow-up pass confirming these 8 are all the same "intentionally fetch once,
deps array is correct as-is" shape rather than genuine staleness bugs — I did
not read each one's full effect body to verify correctness, only confirmed
the disable exists and is unexplained.

**`@typescript-eslint/no-unused-vars` (1 occurrence)** — `src/lib/utils.ts:82`
— this one _does_ explain itself ("kept for signature compatibility, see
comment above"). Good example of how the others should read.

### 2.3 Leftover TODOs

Only 3 hits for `TODO|FIXME|XXX` in `src/`, and all 3 are `TODO(i18n)` —
exactly the expected/known category the task description called out, from
the recent Vietnamese-translation pass:

- `src/lib/auth-helpers.ts:83` — `requireAnyRole`'s thrown error message
  stays English-only.
- `src/lib/email.ts:71` — a function whose only caller is
  `forgot-password/route.ts` isn't translated yet.
- `src/services/bookings.ts:26` — this file's own `notify()` title/message
  string literals aren't translated yet.

No surprises here — no `FIXME`, no `XXX`, no non-i18n `TODO` anywhere in
`src/`. This is a clean result, not a gap.

### 2.4 Business logic in components

Best 6 examples found (not exhaustive, per the task's own framing):

1. **Rental-day pricing math duplicated in 3 places, none in
   `src/services/**` (Medium — genuine drift risk)**
   The formula `Math.max(1, Math.round((rentalEnd - rentalStart) /
86_400_000))` (days in a rental) appears independently in:
   - `src/services/orders.ts:134-143` (server-side, authoritative — order
     creation)
   - `src/components/cart/cart-utils.ts:32-40` (`itemLineTotal`, used for
     cart subtotal display)
   - `src/app/(public)/shop/[productId]/product-purchase-panel.tsx:56-63`
     (product page's live price preview — does **not** call `cart-utils`,
     reimplements the formula inline)
   - `src/components/cart/cart-item-row.tsx:22-30` (reimplements the same
     formula inline just to render the "`N` days" label, immediately
     alongside an import of `itemLineTotal` from the very `cart-utils.ts`
     that already contains this exact calculation internally — the
     component could have exported a `rentalDays()` helper from `cart-utils`
     instead of re-deriving it)
     Four independent copies of one rounding rule. If the business rule ever
     changes (e.g., always round up instead of round-to-nearest, or charge a
     minimum of 2 days), a change would need to land in up to 4 places, and
     nothing enforces they stay in sync. Recommend a single exported
     `calculateRentalDays()` in `src/services/**` (or a shared
     `src/lib/pricing.ts`) that all four call sites import.

2. **The 24-hour minimum-notice / cancellation-window rule is defined
   independently 3 times with no shared constant (Medium)**
   - `src/services/bookings.ts:38` — `const MIN_NOTICE_HOURS = 24;` (used at
     booking-creation validation, `bookings.ts:272`)
   - `src/services/availability.ts:34` — its own separate `const
MIN_NOTICE_HOURS = 24;` (used to mark slots unavailable when too soon)
   - `src/app/(dashboard)/dashboard/bookings/[id]/page.tsx:194-196` — a
     third, hardcoded copy: `new Date(booking.date).getTime() - now < 24 *
60 * 60 * 1000`, used client-side purely to show a "within 24 hours"
     warning banner before the user confirms a cancel/reschedule action.
     The component's copy is UI-only (the server presumably re-validates), so
     this isn't a security issue, but it's the same magic number spelled out
     three different ways in three files with zero shared source of truth —
     an easy thing to silently drift (e.g. if the business rule changes to 48
     hours, the warning banner could go stale while the real enforcement
     changes, confusing users).

3. **`src/app/(public)/shop/[productId]/product-purchase-panel.tsx:56-63`**
   — beyond the rental-days duplication above, this "use client" component
   independently computes the full purchase total (`rentalSubtotal =
rentalDays * rentalPrice`, then adds deposit) rather than calling a
   shared pricing function — this is the same shape of logic
   `services/orders.ts` already has for real order totals, just reimplemented
   for the pre-purchase preview.

4. **`src/components/cart/cart-utils.ts`** — this file (`itemLineTotal`,
   `cartTotals`, `groupByShop`) is genuinely reusable pricing logic, but it
   lives under `src/components/cart/`, not `src/services/**`. It's already
   correctly _centralized_ relative to the rest of the cart UI (better than
   the two ad-hoc reimplementations above), just in the wrong layer per
   CLAUDE.md's stated architecture (`src/services/` = "server-side business
   logic"). Low-severity structural note, not a bug — flagging because it's
   the shared module the other 2 duplicates in finding #1 should have used
   but didn't, and because CLAUDE.md's own folder-structure doc implies this
   math belongs in `services/`.

5. **`src/components/layout/past-due-banner.tsx:9-22`** — a server
   component that queries `Subscription` directly (`where: { status:
"PAST_DUE", graceEndsAt: { gt: new Date() } }`) and computes
   `daysRemaining = Math.ceil((graceEndsAt - now) / 86_400_000)` inline,
   rather than calling something like `getGracePeriodStatus()` from
   `services/subscription.ts`. Low severity — it's a small, self-contained
   read-only calc — but it's a direct `db.*` call from inside
   `src/components/**`, which is a sharper deviation from the "Server
   Components fetch data at the component level" convention than the
   others: this one also embeds a business rule (what counts as "still in
   grace") rather than just fetching.

6. **`src/app/(public)/booking/[providerId]/booking-wizard.tsx:272-274`** —
   client-side re-validation of the same `MIN_NOTICE_HOURS` rule (see #2)
   against the selected slot before allowing submission, again duplicating
   the constant rather than importing it from `services/bookings.ts` or
   `services/availability.ts`. Reasonable as a client-side pre-check (real
   enforcement is presumably still server-side), but it's a fourth site
   carrying the same magic number from finding #2.

**Overall assessment for 2.4:** no single instance is severe on its own —
these are all thin, mostly-presentational duplications rather than deep
business rules leaking into components — but the _pattern_ (pricing math
and the min-notice window each independently reimplemented 3-4 times) is
worth a cleanup pass before scale makes the drift risk real, especially
since `MVP` scope work (per CLAUDE.md) is actively still touching booking
and marketplace code.
