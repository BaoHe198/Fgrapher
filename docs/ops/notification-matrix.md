# Notification matrix

The authoritative, machine-checked version of this table is
[`src/lib/notifications.ts`](../../src/lib/notifications.ts) —
`NOTIFICATION_POLICY`. This file is the human-readable companion; the test
`src/lib/__tests__/notifications.test.ts` asserts every `NotificationType`
has an entry and that the feature gating behaves as described here. Update
both together.

## How a notification is delivered

`services/notification.ts` exposes two entry points:

| Function           | In-app row                                                         | Email                                                                                                                                 | Preference-gated                                            |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `notify()`         | yes, if the type's `inApp` and the recipient's in-app toggle allow | only when the type's `email` policy is `preference` **and** the recipient's email toggle allows **and** an `email` payload was passed | yes                                                         |
| `notifyCritical()` | always                                                             | always, when an `email` payload was passed                                                                                            | no — account/billing/legal, delivered like a password reset |

Both are **inert for a type whose feature flag is off**: no row, no email.
`listNotifications()` applies the same gate on read, so rows written before
a flag was turned off never surface in the bell, the list or the unread
count.

### Email idempotency

Every preference-gated email is reserved in the `email_outbox` (a
unique-key insert) **before** it is sent, so two concurrent triggers for
the same event produce one email, not two. The key is
`<emailScope>:<…event parts…>:<recipientId>` — recipient-scoped, so the
same event to both parties stays distinct.

`NEW_MESSAGE` additionally throttles: at most one email per
**recipient + conversation** per **15 minutes**, measured against the
actual last send (not a wall-clock bucket) and enforced under a Postgres
advisory transaction lock so the "is there a recent one?" check and the
reservation insert are atomic (`reserveThrottledEmail`).

### Provider-side idempotency

The reservation key is also passed to Resend as its `Idempotency-Key`
header (SDK v6). So the one remaining gap — the process crashes _after_
Resend accepted the email but _before_ `finalizeReservedEmail` writes the
row terminal, the stale-lock sweep returns the row to PENDING, and the
cron re-delivers — does not produce a duplicate: Resend dedupes on that
key for ~24h. Residual: a finalize failure that stays unresolved for
longer than Resend's 24h key retention, which the retry budget (5 attempts
over ~30 min) makes unreachable in practice.

## Locale

Emails and in-app copy are rendered in **the triggering request's cookie
locale**, or **`vi`** for anything with no request context (crons, the
EXPIRED booking sweep, `notifyMatchingProviders`, Stripe webhooks). They
are **not** rendered in the recipient's own preferred language — `User`
has no stored locale. In practice the platform is Vietnamese-only
(`routing.defaultLocale = "vi"`, CLAUDE.md rule 10), so this is a
theoretical gap: an EN-cookie admin actioning a moderation item would send
that one provider an EN email. Wiring a per-user locale is a follow-up
(needs a schema column).

## The matrix

Feature legend: **core** = MVP, always on. **social** / **marketplace** =
out of MVP scope (CLAUDE.md "Ngoài phạm vi MVP"), dormant behind
`SOCIAL_FEED_ENABLED` / `MARKETPLACE_ENABLED` — no email, no in-app row, no
UI, not counted. Email legend: **pref** = sent if the recipient's channel
preference allows; **critical** = always sent; **none** = never emailed
(in-app only).

| NotificationType              | Feature               | In-app | Email                                              | Preference toggle  | Template                                                                                     | Triggered from                        |
| ----------------------------- | --------------------- | ------ | -------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| `BOOKING_REQUEST`             | core                  | yes    | pref                                               | `bookingRequest`   | `bookingRequestEmailHtml`                                                                    | `createBooking`                       |
| `BOOKING_CONFIRMED`           | core                  | yes    | pref                                               | `bookingConfirmed` | `bookingConfirmedEmailHtml`                                                                  | `transitionBooking`                   |
| `BOOKING_DECLINED`            | core                  | yes    | pref                                               | `bookingCancelled` | `bookingDeclinedEmailHtml`                                                                   | `transitionBooking`                   |
| `BOOKING_CANCELLED`           | core                  | yes    | pref                                               | `bookingCancelled` | `bookingCancelledEmailHtml` / `bookingExpiredEmailHtml` / `bookingRelatedCancelledEmailHtml` | `transitionBooking`, `expireBookings` |
| `BOOKING_REMINDER`            | core                  | yes    | pref                                               | `bookingReminder`  | `bookingReminderEmailHtml`                                                                   | `sendBookingReminders` (cron)         |
| `BOOKING_RESCHEDULE_PROPOSED` | core                  | yes    | pref                                               | `bookingRequest`   | `bookingRescheduleProposedEmailHtml`                                                         | `proposeReschedule`                   |
| `BOOKING_COMPLETED`           | core                  | yes    | pref                                               | `bookingConfirmed` | `bookingCompletedEmailHtml`                                                                  | `transitionBooking`                   |
| `NEW_MESSAGE`                 | core                  | yes    | pref (throttled 15 min / conversation / recipient) | `newMessage`       | `newMessageEmailHtml`                                                                        | `sendMessage` (text/image only)       |
| `NEW_REVIEW`                  | core                  | yes    | pref                                               | `newReview`        | `newReviewEmailHtml`                                                                         | `createReview`                        |
| `REVIEW_RESPONSE`             | core                  | yes    | pref                                               | `newReview`        | `reviewResponseEmailHtml`                                                                    | `respondToReview`                     |
| `REQUEST_NEW_MATCH`           | core                  | yes    | **none** (fan-out to many providers — in-app only) | `serviceRequests`  | —                                                                                            | `notifyMatchingProviders`             |
| `REQUEST_NEW_OFFER`           | core                  | yes    | pref                                               | `serviceRequests`  | `requestNewOfferEmailHtml`                                                                   | `createOffer`                         |
| `REQUEST_OFFER_ACCEPTED`      | core                  | yes    | pref                                               | `serviceRequests`  | `requestOfferAcceptedEmailHtml`                                                              | `acceptOffer`                         |
| `REQUEST_OFFER_DECLINED`      | core                  | yes    | pref                                               | `serviceRequests`  | `requestOfferDeclinedEmailHtml`                                                              | `acceptOffer`, `declineOffer`         |
| `REQUEST_NO_OFFERS_48H`       | core                  | yes    | pref                                               | `serviceRequests`  | `requestNoOffersEmailHtml`                                                                   | `nudgeUnansweredRequests` (cron)      |
| `SUBSCRIPTION_ACTIVE`         | core                  | yes    | critical                                           | —                  | `welcomeSubscriptionEmailHtml` / `receiptEmailHtml`                                          | `subscription.ts`, `payments.ts`      |
| `SUBSCRIPTION_EXPIRING`       | core                  | yes    | critical                                           | —                  | `subscriptionCancellingEmailHtml`                                                            | `subscription.ts`, `payments.ts`      |
| `SUBSCRIPTION_CANCELLED`      | core                  | yes    | critical                                           | —                  | `subscriptionEndedEmailHtml`                                                                 | `subscription.ts`, `payments.ts`      |
| `PAYMENT_FAILED`              | core                  | yes    | critical                                           | —                  | `paymentFailedEmailHtml` / shell                                                             | `subscription.ts`, `payments.ts`      |
| `MEDIA_APPROVED`              | core                  | yes    | critical                                           | —                  | `mediaApprovedEmailHtml`                                                                     | `admin.ts` moderation                 |
| `MEDIA_REJECTED`              | core                  | yes    | critical                                           | —                  | `mediaRejectedEmailHtml`                                                                     | `admin.ts` moderation                 |
| `ROLE_CHANGE_APPROVED`        | core                  | yes    | critical                                           | —                  | shell                                                                                        | `role-change-requests.ts`             |
| `ROLE_CHANGE_REJECTED`        | core                  | yes    | critical                                           | —                  | shell                                                                                        | `role-change-requests.ts`             |
| `NEW_FOLLOWER`                | social (dormant)      | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `NEW_LIKE`                    | social (dormant)      | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `NEW_COMMENT`                 | social (dormant)      | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `NEW_ORDER`                   | marketplace (dormant) | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `ORDER_CONFIRMED`             | marketplace (dormant) | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `ORDER_SHIPPED`               | marketplace (dormant) | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `ORDER_DELIVERED`             | marketplace (dormant) | —      | —                                                  | —                  | —                                                                                            | —                                     |
| `ORDER_CANCELLED`             | marketplace (dormant) | —      | —                                                  | —                  | —                                                                                            | —                                     |

### Preference toggles

`src/lib/validations/user.ts` `NOTIFICATION_KEYS` — the rows shown on
`/dashboard/settings/notifications`, each with an email + in-app switch:

- `bookingRequest`, `bookingConfirmed`, `bookingCancelled`, `bookingReminder`
- `newMessage`
- `serviceRequests` (reverse marketplace)
- `newReview`
- `newFollower` — only visible while `SOCIAL_FEED_ENABLED`
- `productUpdates`, `tips` — retained for schema stability; not rendered
  and not wired to any sender (no marketing NotificationType exists)

## Known limitations

- **`notifyCritical` emails now reserve before send** (like preference
  emails) and every critical call site passes `dedupe`, so a retried
  billing/moderation run no longer double-sends. `buildEmailDedupe` throws
  if a would-be email has no event identity, so a future call site can't
  regress this silently.
- Marketplace/social notification code paths (`orders.ts`, follow/like)
  still call `notify()` with dormant types; those calls return before
  touching email or the DB (feature gate in `deliver()`), and the call
  sites remain for when the feature is revived. If marketplace is ever
  enabled, `orders.ts`'s `notify({... email ...})` calls will need
  `dedupe` added or they will throw.
- `SUBSCRIPTION_EXPIRING` in-app-only notifications (no email payload) are
  not reservation-deduped — they were never emailed and the in-app row is
  guarded by the caller's own "already warned" timestamp.
