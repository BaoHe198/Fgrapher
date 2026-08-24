# Pre-launch audit: API route permissions

Scope: every `src/app/api/**/route.ts` file (83 files, 104 exported HTTP
method handlers) — read-only audit, no files besides this report were
edited. For each handler: who _should_ be allowed to call it, where that's
actually enforced (quoting the check), and a verdict.

Enforcement primitives referenced below (all from
`src/lib/auth-helpers.ts` / `src/lib/admin.ts`):

- `requireAuth()` — throws 401 if no session. Returns the session.
- `requireRole(userId, role)` — throws 403 if the user doesn't hold `role` (active `UserRole` row).
- `requireActiveSubscription(userId, role)` — `requireRole` + throws 403 if no usable (ACTIVE/TRIALING/grace-period PAST_DUE) subscription for that role.
- `requirePaidRole(userId)` — throws 403 if the user holds no paid role with a usable subscription.
- `requireAdmin()` — `requireAuth()` + throws 403 if no active `ADMIN` `UserRole` row.

## Summary — routes needing attention

**No route was found with a genuinely missing auth/ownership check.** Every
admin route calls `requireAdmin()`; every dynamic-segment route that reads
or mutates a specific resource either scopes its DB query to
`session.user.id` or has the service-layer function verify the caller is
the resource's owner/participant (verified by reading the service code,
not just the route file — see the "Ownership checks verified in service
layer" note under each relevant table).

One structural risk applies to all three cron routes and is worth flagging
even though it's not a missing-check bug in the code as written:

| Path + method                       | Issue                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/cron/booking-reminders`   | **Fail-open if `CRON_SECRET` is unset.** The guard is `if (process.env.CRON_SECRET && authHeader !== ...)` — when the env var itself is absent/empty, the whole condition is `false` and the check is skipped entirely, leaving the route open to _any_ unauthenticated caller. Low severity here (triggers reminder emails). |
| `GET /api/cron/expire-bookings`     | Same pattern, same fail-open risk. Low-medium severity (lets anyone force-expire pending bookings, a minor DoS/annoyance vector).                                                                                                                                                                                             |
| `GET /api/cron/purge-kyc-documents` | Same pattern. **Higher severity** — this one deletes identity-document data; an unauthenticated caller could trigger early purges (or be relied upon to run it, silently doing nothing if `CRON_SECRET` was intended to be set but a deploy typo'd the var name, in which case it fails open rather than failing closed).     |

Verdict for all three: **OK as long as `CRON_SECRET` is always set in every
deployed environment** — but the code has no way to _guarantee_ that, and a
missing env var degrades to "no auth" rather than "reject all requests"
(the safer failure mode). Recommend changing the guard to reject when
`CRON_SECRET` is unset (fail closed) rather than skip the check. A separate
human audit is checking whether these are registered in `vercel.json`;
this finding is about the code-level fallback behavior, independent of
that.

No other MISSING or UNCLEAR verdicts were found. Every other row below is
OK.

---

## `/api/admin/**` — all require `requireAdmin()`

| Path + method                             | Intended caller                                                                  | Enforcement                                                                                                                                                           | Verdict |
| ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `GET /api/admin/audit-log`                | Admin only                                                                       | `await requireAdmin();` (line 17)                                                                                                                                     | OK      |
| `GET /api/admin/consent-stats`            | Admin only                                                                       | `await requireAdmin();` (line 11)                                                                                                                                     | OK      |
| `PATCH /api/admin/data-requests/[id]`     | Admin only                                                                       | `const session = await requireAdmin();` (line 15)                                                                                                                     | OK      |
| `GET /api/admin/data-requests`            | Admin only                                                                       | `await requireAdmin();` (line 19)                                                                                                                                     | OK      |
| `GET /api/admin/moderation`               | Admin only                                                                       | `await requireAdmin();` (line 12)                                                                                                                                     | OK      |
| `PATCH /api/admin/moderation`             | Admin only                                                                       | `const session = await requireAdmin();` (line 41)                                                                                                                     | OK      |
| `PATCH /api/admin/reports/[id]`           | Admin only                                                                       | `const session = await requireAdmin();` (line 15)                                                                                                                     | OK      |
| `GET /api/admin/reports`                  | Admin only                                                                       | `await requireAdmin();` (line 18)                                                                                                                                     | OK      |
| `GET /api/admin/stats`                    | Admin only                                                                       | `await requireAdmin();` (line 11)                                                                                                                                     | OK      |
| `GET /api/admin/users/[id]`               | Admin only                                                                       | `await requireAdmin();` (line 23)                                                                                                                                     | OK      |
| `PATCH /api/admin/users/[id]`             | Admin only, actions logged                                                       | `const session = await requireAdmin();` (line 59) + `logAdminAction(...)` after every action                                                                          | OK      |
| `GET /api/admin/users`                    | Admin only                                                                       | `await requireAdmin();` (line 11)                                                                                                                                     | OK      |
| `GET /api/admin/verifications/[id]/image` | Admin only; every view of a KYC document must be audit-logged (CLAUDE.md rule 7) | `const session = await requireAdmin();` (line 16), then `getKycImageUrl({..., adminId: session.user.id, ipAddress})` — audit logging happens inside that service call | OK      |
| `PATCH /api/admin/verifications/[id]`     | Admin only                                                                       | `const session = await requireAdmin();` (line 15)                                                                                                                     | OK      |
| `GET /api/admin/verifications`            | Admin only                                                                       | `await requireAdmin();` (line 11)                                                                                                                                     | OK      |

All 15 admin handlers verified — no gaps.

---

## `/api/auth/**`

| Path + method                        | Intended caller                                             | Enforcement                                                                                                                                 | Verdict                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`/`POST /api/auth/[...nextauth]` | Public — this _is_ the auth system                          | NextAuth v5 `handlers` (`src/lib/auth.ts`)                                                                                                  | OK (out of scope for custom checks — framework-managed)                                                                              |
| `POST /api/auth/forgot-password`     | Public/unauthenticated                                      | None (intentional)                                                                                                                          | OK — always returns success regardless of whether the email exists, explicitly to prevent enumeration (see comment at line 35-36)    |
| `POST /api/auth/register`            | Public/unauthenticated                                      | None (intentional)                                                                                                                          | OK — age-gate (≥18) and role/consent validation happen via `registerSchema` before the account is created, matching CLAUDE.md rule 4 |
| `POST /api/auth/reset-password`      | Public, but gated by possession of a valid, unexpired token | Token lookup: `record.expires < new Date()` check (line 32) — not a session check, but appropriate since the token itself is the credential | OK                                                                                                                                   |

---

## `/api/availability/**`, `/api/blocked-dates/**`, `/api/blocks`

| Path + method                        | Intended caller                                                                 | Enforcement                                                                                                           | Verdict                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/availability/[providerId]` | Public/unauthenticated — booking widget needs to show any provider's open slots | None (intentional)                                                                                                    | OK — read-only, no PII, deliberately public for the booking flow |
| `GET /api/availability`              | Own schedule only                                                               | `requireAuth()` + query scoped to `session.user.id` (lines 11, 15, 19)                                                | OK                                                               |
| `PUT /api/availability`              | Own schedule only                                                               | `requireAuth()` + delete/create scoped to `session.user.id` (lines 46, 62-67)                                         | OK                                                               |
| `DELETE /api/blocked-dates/[id]`     | Only the date's owner                                                           | `requireAuth()` + explicit ownership check: `if (!blockedDate \|\| blockedDate.userId !== session.user.id)` (line 17) | OK                                                               |
| `POST /api/blocked-dates`            | Own calendar only                                                               | `requireAuth()` + upsert scoped to `session.user.id` (lines 11, 29-38)                                                | OK                                                               |
| `POST /api/blocks`                   | Any authenticated user, blocking scoped to themselves                           | `requireAuth()` (line 11), `blockUser(session.user.id, ...)`                                                          | OK                                                               |
| `DELETE /api/blocks`                 | Any authenticated user, unblocking scoped to themselves                         | `requireAuth()` (line 51), `unblockUser(session.user.id, ...)`                                                        | OK                                                               |

---

## `/api/bookings/**`

Ownership checks verified in `src/services/bookings.ts`: `getBookingDetail`
returns `null` unless `booking.customerId === userId \|\| booking.providerId
=== userId` (line 216); `transitionBooking` throws 403 for a non-participant
(`!isProvider && !isCustomer`, line 489) and further restricts
provider-only transitions (accept/decline/complete/no-show, lines 495-506);
`proposeReschedule`/`respondToReschedule` both check participant membership
before acting.

| Path + method                         | Intended caller                                   | Enforcement                                                                                                                                                                           | Verdict |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `POST /api/bookings/[id]/reschedule`  | Booking's customer or provider only               | `requireAuth()` + `proposeReschedule()` checks `isProvider \|\| isCustomer` (services/bookings.ts:661)                                                                                | OK      |
| `PATCH /api/bookings/[id]/reschedule` | Booking's customer or provider only               | `requireAuth()` + `respondToReschedule()` (participant-scoped, same file)                                                                                                             | OK      |
| `GET /api/bookings/[id]`              | Only the booking's customer or provider           | `requireAuth()` + `getBookingDetail(id, session.user.id)` returns `null` (→404) for non-participants (services/bookings.ts:214-219)                                                   | OK      |
| `PATCH /api/bookings/[id]`            | Customer/provider, with provider-only sub-actions | `requireAuth()` + `transitionBooking()`'s participant + role checks (services/bookings.ts:472-516)                                                                                    | OK      |
| `GET /api/bookings/calendar`          | Own bookings as provider                          | `requireAuth()`, `listBookingsForRange({providerId: session.user.id, ...})` (line 22)                                                                                                 | OK      |
| `GET /api/bookings`                   | Own bookings (as customer or provider)            | `requireAuth()`, `listBookings({userId: session.user.id, ...})` (line 35)                                                                                                             | OK      |
| `POST /api/bookings`                  | Any authenticated user, as the customer           | `requireAuth()`, `createBooking(session.user.id, ...)`; service also blocks self-booking and validates `parentBookingId` belongs to the requester (services/bookings.ts:266, 311-320) | OK      |

---

## `/api/cart/**`, `/api/orders/**`, `/api/products/**`, `/api/shop-products/**`, `/api/services/**` (marketplace — dormant behind `MARKETPLACE_ENABLED`)

Ownership checks verified in `src/services/products.ts` (`updateProduct`/
`deleteProduct`/`duplicateProduct` all check `existing.userId !== userId`
→ 404) and `src/services/orders.ts` (`getOrderDetail` checks
`order.customerId !== userId && order.shopId !== userId`; `updateOrderStatus`
computes `isShop`/`isCustomer`; `markRentalReturned` checks `order.shopId
!== userId`).

| Path + method                       | Intended caller                                | Enforcement                                                                                                                                            | Verdict |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `PATCH /api/cart/[id]`              | Own cart item only                             | `requireAuth()` + `updateCartItemQuantity(id, session.user.id, ...)`                                                                                   | OK      |
| `DELETE /api/cart/[id]`             | Own cart item only                             | `requireAuth()` + `removeCartItem(id, session.user.id)`                                                                                                | OK      |
| `GET /api/cart`                     | Own cart                                       | `requireAuth()` + `getCart(session.user.id)`                                                                                                           | OK      |
| `POST /api/cart`                    | Any authenticated user, own cart               | `requireAuth()` + `addToCart({userId: session.user.id, ...})`                                                                                          | OK      |
| `POST /api/orders/[id]/return`      | Only the shop that owns the rental order       | `requireAuth()` + `markRentalReturned` checks `order.shopId !== userId` (services/orders.ts:443)                                                       | OK      |
| `GET /api/orders/[id]`              | Only the order's customer or shop              | `requireAuth()` + `getOrderDetail` checks both IDs (services/orders.ts:323)                                                                            | OK      |
| `PATCH /api/orders/[id]/status`     | Order's customer or shop, action-restricted    | `requireAuth()` + `updateOrderStatus` computes `isShop`/`isCustomer` (services/orders.ts:370-371)                                                      | OK      |
| `POST /api/orders/checkout`         | Any authenticated user, own cart               | `requireAuth()` + `createCheckoutSessionForCart(session.user.id, ...)`                                                                                 | OK      |
| `GET /api/orders`                   | Own orders (as customer or shop, via `?role=`) | `requireAuth()` + `listOrders({userId: session.user.id, ...})`                                                                                         | OK      |
| `POST /api/products/[id]/duplicate` | Only the product's owning shop                 | `requireAuth()` + `duplicateProduct` checks `existing.userId !== userId` (services/products.ts:83)                                                     | OK      |
| `GET /api/products/[id]`            | Public — product detail page                   | None (intentional)                                                                                                                                     | OK      |
| `PATCH /api/products/[id]`          | Only the product's owning shop                 | `requireAuth()` + `updateProduct` ownership check (services/products.ts:45)                                                                            | OK      |
| `DELETE /api/products/[id]`         | Only the product's owning shop                 | `requireAuth()` + `deleteProduct` ownership check (services/products.ts:73)                                                                            | OK      |
| `GET /api/products`                 | Own product listings (dashboard)               | `requireAuth()` + `listProducts({userId: session.user.id, ...})`                                                                                       | OK      |
| `POST /api/products`                | `CAMERA_SHOP` role with active subscription    | `requireAuth()` + `requireActiveSubscription(session.user.id, "CAMERA_SHOP")` (line 66)                                                                | OK      |
| `GET /api/shop-products/[id]`       | Public — product browse detail                 | None (intentional)                                                                                                                                     | OK      |
| `GET /api/shop-products`            | Public — product search/browse                 | None (intentional)                                                                                                                                     | OK      |
| `PATCH /api/services/[id]`          | Only the service's owning profile              | `requireAuth()` + local `assertOwnedService()` helper checks `service.profile.userId === userId` (line 12)                                             | OK      |
| `DELETE /api/services/[id]`         | Only the service's owning profile              | Same `assertOwnedService()` check                                                                                                                      | OK      |
| `POST /api/services`                | Own profile, active subscription for that role | `requireAuth()` + explicit `profile.userId !== session.user.id` check (line 25) + `requireActiveSubscription(session.user.id, profile.role)` (line 32) | OK      |

---

## `/api/contact`, `/api/geography/wards`, `/api/search`

| Path + method              | Intended caller                                                    | Enforcement                                   | Verdict                    |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------- |
| `POST /api/contact`        | Public/unauthenticated                                             | None (intentional)                            | OK — standard contact form |
| `GET /api/geography/wards` | Public/unauthenticated (needed pre-login on the registration form) | None (intentional, per code comment line 5-7) | OK                         |
| `GET /api/search`          | Public/unauthenticated — profile search/browse                     | None (intentional)                            | OK                         |

---

## `/api/conversations/**`, `/api/messages`

Ownership/membership checks verified in `src/services/messaging.ts`: a
private `requireParticipant(conversationId, userId)` helper (line 121)
looks up the `ConversationParticipant` row and throws
`MessagingError("You are not part of this conversation", 403)` if absent —
called at the top of `listMessages`, `sendMessage`, and
`markConversationRead`.

| Path + method                          | Intended caller                                                              | Enforcement                                                                                         | Verdict |
| -------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| `GET /api/conversations/[id]/messages` | Only conversation participants                                               | `requireAuth()` + `listMessages()` → `requireParticipant()`                                         | OK      |
| `PATCH /api/conversations/[id]/read`   | Only conversation participants                                               | `requireAuth()` + `markConversationRead()` → `requireParticipant()`                                 | OK      |
| `GET /api/conversations`               | Own conversations                                                            | `requireAuth()` + `listConversations(session.user.id, ...)`                                         | OK      |
| `POST /api/conversations`              | Any authenticated user (starts/finds a conversation with another user)       | `requireAuth()` + `getOrCreateConversation(session.user.id, ...)`                                   | OK      |
| `GET /api/conversations/unread-count`  | Own unread count                                                             | `requireAuth()` + `getUnreadConversationCount(session.user.id)`                                     | OK      |
| `POST /api/messages`                   | Only conversation participants, and not if either side has blocked the other | `requireAuth()` + `sendMessage()` → `requireParticipant()` + `isBlocked()` check (messaging.ts:193) | OK      |

---

## `/api/cron/**` — see Summary above for the fail-open risk

| Path + method                       | Intended caller                                  | Enforcement                                                                                     | Verdict                                                                                                                            |
| ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/cron/booking-reminders`   | Vercel Cron only, via `CRON_SECRET` bearer token | `if (process.env.CRON_SECRET && authHeader !== \`Bearer ${process.env.CRON_SECRET}\`)` (line 7) | **MISSING (conditional)** — correct when `CRON_SECRET` is set, but silently unauthenticated if the env var is absent. See Summary. |
| `GET /api/cron/expire-bookings`     | Same                                             | Same pattern (line 7-10)                                                                        | **MISSING (conditional)** — same issue                                                                                             |
| `GET /api/cron/purge-kyc-documents` | Same                                             | Same pattern (line 7-10)                                                                        | **MISSING (conditional)** — same issue, higher severity given it deletes KYC documents                                             |

---

## `/api/dashboard/stats`, `/api/follows/**`

| Path + method              | Intended caller                                                     | Enforcement                                                                                                 | Verdict |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| `GET /api/dashboard/stats` | Own dashboard stats                                                 | `requireAuth()` + stats scoped to `session.user.id` (lines 14, 17-18)                                       | OK      |
| `POST /api/follows`        | Any authenticated user, follows scoped to self; self-follow blocked | `requireAuth()` + `followerId: session.user.id` + explicit `userId === session.user.id` rejection (line 31) | OK      |
| `DELETE /api/follows`      | Any authenticated user, own follow relationship only                | `requireAuth()` + `deleteMany({followerId: session.user.id, ...})`                                          | OK      |
| `GET /api/follows/status`  | Own follow/save state for a given target                            | `requireAuth()` + query scoped to `session.user.id` (lines 15, 36-44)                                       | OK      |

---

## `/api/notifications/**`

| Path + method                        | Intended caller               | Enforcement                                                                                                                                                                                                                          | Verdict |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `PATCH /api/notifications/[id]/read` | Only the notification's owner | `requireAuth()` + `markNotificationRead(id, session.user.id)` → `db.notification.updateMany({where: {id, userId, readAt: null}, ...})` (services/notification.ts:166-169) — scoped update is a no-op for another user's notification | OK      |
| `POST /api/notifications/read-all`   | Own notifications             | `requireAuth()` + `markAllNotificationsRead(session.user.id)`                                                                                                                                                                        | OK      |
| `GET /api/notifications`             | Own notifications             | `requireAuth()` + `listNotifications({userId: session.user.id, ...})`                                                                                                                                                                | OK      |

---

## `/api/portfolio/**`

| Path + method                  | Intended caller                                                   | Enforcement                                                                                                                                                                                                                 | Verdict |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `DELETE /api/portfolio/[id]`   | Only the media's owning profile                                   | `requireAuth()` + explicit check `media.profile.userId !== session.user.id` → 404 (line 25)                                                                                                                                 | OK      |
| `PATCH /api/portfolio/reorder` | Only media the caller owns (all items in the batch)               | `requireAuth()` + `media.every((m) => m.profile.userId === session.user.id)` (line 33)                                                                                                                                      | OK      |
| `POST /api/portfolio`          | Own profile, active subscription for that role, moderation queued | `requireAuth()` + explicit `profile.userId !== session.user.id` check (line 35) + `requireActiveSubscription()` (line 46) — also enforces CLAUDE.md rule 8 (moderation before public display) via `runModeration(media.id)` | OK      |

---

## `/api/profiles/**`, `/api/reports`, `/api/reviews/**`

Ownership checks for reviews verified in `src/services/reviews.ts`:
`updateReview` checks `review.reviewerId !== userId` (line 129);
`respondToReview`/`updateReviewResponse` check `review.reviewedId !==
providerId` (lines 161, 205); `createReview`'s `getReviewEligibility`
checks `booking.customerId !== userId` (line 35).

| Path + method                        | Intended caller                                 | Enforcement                                                                                                                                                         | Verdict |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `PATCH /api/profiles/[role]/publish` | Only a user who holds that role                 | `requireAuth()` + `session.user.roles.includes(role)` (line 29); service also enforces verification-before-publish (`ProfileNotVerifiedError`) per CLAUDE.md rule 5 | OK      |
| `GET /api/profiles/[role]`           | Own profile for that role                       | `requireAuth()` + query scoped to `session.user.id` (line 25)                                                                                                       | OK      |
| `PATCH /api/profiles/[role]`         | Only a user who holds that role                 | `requireAuth()` + `session.user.roles.includes(role)` (line 72)                                                                                                     | OK      |
| `POST /api/reports`                  | Any authenticated user, reporting as themselves | `requireAuth()` + `reporterId: session.user.id`; priority is server-derived, not client-supplied (lines 26-31)                                                      | OK      |
| `POST /api/reviews/[id]/respond`     | Only the review's reviewed provider             | `requireAuth()` + `respondToReview` checks `review.reviewedId !== providerId` (services/reviews.ts:161)                                                             | OK      |
| `PATCH /api/reviews/[id]/respond`    | Only the review's reviewed provider             | `requireAuth()` + `updateReviewResponse` checks `review.reviewedId !== providerId` (services/reviews.ts:205)                                                        | OK      |
| `PATCH /api/reviews/[id]`            | Only the review's original author               | `requireAuth()` + `updateReview` checks `review.reviewerId !== userId` (services/reviews.ts:129)                                                                    | OK      |
| `POST /api/reviews`                  | Only the completed booking's customer           | `requireAuth()` + `createReview` → `getReviewEligibility` checks `booking.customerId !== userId` (services/reviews.ts:35)                                           | OK      |

---

## `/api/saved-profiles`

| Path + method                | Intended caller                        | Enforcement                                                    | Verdict |
| ---------------------------- | -------------------------------------- | -------------------------------------------------------------- | ------- |
| `GET /api/saved-profiles`    | Own saved list                         | `requireAuth()` + scoped to `session.user.id` (line 16)        | OK      |
| `POST /api/saved-profiles`   | Any authenticated user, own saved list | `requireAuth()` + upsert scoped to `session.user.id`           | OK      |
| `DELETE /api/saved-profiles` | Own saved list                         | `requireAuth()` + `deleteMany({userId: session.user.id, ...})` | OK      |

---

## `/api/stripe/**` (dormant behind `BILLING_ENABLED=false`)

| Path + method               | Intended caller                      | Enforcement                                                                                                  | Verdict |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------- |
| `POST /api/stripe/cancel`   | Own subscription only                | `requireAuth()` + subscription looked up via `userId_role: {userId: session.user.id, ...}` (line 33)         | OK      |
| `POST /api/stripe/checkout` | Any authenticated user, own checkout | `requireAuth()` + customer/session tied to `session.user.id`                                                 | OK      |
| `GET /api/stripe/invoices`  | Own invoices only                    | `requireAuth()` + `db.subscription.findFirst({where: {userRole: {userId: session.user.id}, ...}})` (line 29) | OK      |
| `POST /api/stripe/portal`   | Own billing portal only              | `requireAuth()` + same `userRole.userId` scoping (line 25)                                                   | OK      |
| `POST /api/stripe/resume`   | Own subscription only                | `requireAuth()` + `userId_role: {userId: session.user.id, ...}` (line 33)                                    | OK      |

---

## `/api/upload/signature`, `/api/verification/**`, `/api/users/**`

| Path + method                             | Intended caller                                                                                   | Enforcement                                                                                              | Verdict                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `POST /api/upload/signature`              | Any authenticated user for `purpose=chat`; paid-role holders for portfolio/product/profile images | `requireAuth()` + conditional `requirePaidRole(session.user.id)` when `purpose !== "chat"` (lines 18-20) | OK — deliberate, documented exception for chat images |
| `POST /api/verification`                  | Any authenticated user, submitting KYC for their own account                                      | `requireAuth()` + `submitVerification({userId: session.user.id, ...})`                                   | OK                                                    |
| `POST /api/verification/upload-signature` | Any authenticated user, own KYC upload                                                            | `requireAuth()` + `generateKycUploadSignature(session.user.id)`                                          | OK                                                    |
| `POST /api/users/me/consent`              | Own consent record                                                                                | `requireAuth()` + `recordConsent({userId: session.user.id, ...})`                                        | OK                                                    |
| `POST /api/users/me/deletion-request`     | Own account only                                                                                  | `requireAuth()` + `requestDeletion(session.user.id)`, deduped against existing pending request           | OK                                                    |
| `POST /api/users/me/export`               | Own data export only                                                                              | `requireAuth()` + `exportUserData(session.user.id)`                                                      | OK                                                    |
| `POST /api/users/me/password`             | Own password only                                                                                 | `requireAuth()` + current-password re-verification via `bcrypt.compare` before allowing change (line 37) | OK                                                    |
| `GET /api/users/me`                       | Own account                                                                                       | `requireAuth()` + `db.user.findUnique({where: {id: session.user.id}, ...})`                              | OK                                                    |
| `PATCH /api/users/me`                     | Own account                                                                                       | `requireAuth()` + `db.user.update({where: {id: session.user.id}, ...})`                                  | OK                                                    |
| `DELETE /api/users/me`                    | Own account (soft delete)                                                                         | `requireAuth()` + `db.user.update({where: {id: session.user.id}, data: {deletedAt: ...}})`               | OK                                                    |
| `POST /api/users/roles`                   | Own roles only                                                                                    | `requireAuth()` + upsert scoped to `session.user.id`; `CUSTOMER` force-included, can't be dropped        | OK                                                    |
| `GET /api/users/username-available`       | Any authenticated user checking availability (including their own current username)               | `requireAuth()` + `existing.id === session.user.id` counted as "available" (line 20)                     | OK                                                    |

---

## `/api/webhooks/stripe`

| Path + method               | Intended caller                 | Enforcement                                                                                                                                                                                                                                                                                  | Verdict                                                                                               |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /api/webhooks/stripe` | Stripe only, via signed payload | Reads raw body (not `req.json()`, to preserve bytes for signature verification) + `constructWebhookEvent(rawBody, signature)` validates the `stripe-signature` header (lines 37-55); rejects with 400 on missing/invalid signature; idempotent via `WebhookEvent` table dedupe on `event.id` | OK — properly verifies signature, not session-based (correctly so, since Stripe can't hold a session) |

---

## Notes on methodology

- Every route file under `src/app/api` (83 files, found via `find src/app/api -name "route.ts"`) was read in full.
- For every dynamic-segment (`[id]`, `[role]`, `[providerId]`) route that reads or mutates a specific resource, the underlying service-layer function (in `src/services/*.ts`) was also read to confirm the ownership/participant check actually exists there, not just that _some_ auth check runs. This was necessary because most routes delegate the resource-scoping logic to the service layer rather than checking inline in the route handler.
- Deep sensitive-data-leak analysis (e.g., whether a public GET response includes fields it shouldn't) was intentionally left to a separate report per the task brief; this report focuses on caller-identity/authorization checks.
