# Content moderation — tier 1 (automated) + tier 2 (human)

## The shape of it

Every portfolio upload has always landed in the human queue at
`/admin/moderation` as `PENDING`, and nothing becomes public until an admin
approves it (`ProfileMedia.moderationStatus`, enforced at the query layer by
`services/search.ts` and at publish time by `setProfilePublished()`).

Tier 1 does not change that contract. It gets a clear violation off the public
profile immediately instead of waiting for the queue — but the photo stays in
the queue either way, so a human always has the last word:

```
upload → ProfileMedia created (PENDING)
       → runModeration() [fire-and-forget]
           → OpenAI omni-moderation-latest
               → score ≥ 0.9 on sexual | violence/graphic
                     → AUTO_REJECTED (hidden), no penalty
                        → still listed in the admin queue, badged
                          "auto-hidden", for a human to confirm or overturn
               → anything else, or the scan couldn't run
                     → stays PENDING → admin queue
```

**Tier 1 never approves anything, and never penalises anyone.** The worst case
of a wrong automated answer is extra work for a human, never unreviewed content
going public and never a photographer punished by a model's mistake. Those are
the two properties the whole design rests on, and
`services/__tests__/moderation.test.ts` asserts the first directly.

## What it cannot do — read this before trusting it

`sexual/minors` is a **text-only** category in OpenAI's Moderation API. It is
not evaluated for image input at all. So this scanner **cannot detect a minor in
a photo** — the single case CLAUDE.md's ràng buộc #3 and #4 care most about, and
the one behind the "Appears to be a minor" report reason.

That detection remains entirely with human review and user reports. Enabling
tier 1 must not be read as covering it.

Categories OpenAI does evaluate for images: `sexual`, `violence`,
`violence/graphic`, `self-harm`, `self-harm/intent`, `self-harm/instructions`.
Source: <https://developers.openai.com/api/docs/guides/moderation>

Also not covered:

- **Videos.** `ProfileMedia.type === "VIDEO"` skips the scanner entirely and
  goes straight to a human — the endpoint takes images only, and nothing here
  extracts frames.
- **Anything below the threshold.** By design; see below.

## Who can penalise an account

Only a human. Project owner's decision, 12/09/2026.

`runModeration()` hides a photo and does nothing else — no violation point, no
suspension. Violation points are awarded by `applyViolationStrikes()` in
`services/admin.ts`, reached only from an admin's own reject in the queue, and
three of those still auto-suspend as `/guidelines` says.

One strike per user per **reject action**, not per photo: an admin selecting a
whole album and rejecting it is one moderation decision about one batch, and
counting per-photo would mean a single click on a 20-photo album suspends an
account seven times over.

This is why `listPendingMedia()` returns `AUTO_REJECTED` rows alongside
`PENDING` ones — the photo is already hidden, but a human still confirms or
overturns the machine's call, and it's their reject that carries a consequence.
Without that the scanner's decision would be final with nobody having looked.

## Why the threshold is 0.9 and not OpenAI's own `flagged`

The API returns its own `flagged` boolean, calibrated to catch borderline
content. That calibration is right for "show this to a human" and too eager for
hiding a working photographer's portfolio photo on the spot — an auto-hide is
reversible, but it is still their livelihood off their profile until an admin
gets to the queue.

So the policy reads `category_scores` and requires ≥ 0.9, ignoring `flagged`
entirely. Everything below still reaches the same human, just without being
hidden first. The constant is `AUTO_REJECT_THRESHOLD` in
`services/moderation.ts`.

Only `sexual` and `violence/graphic` are auto-reject grounds. The `self-harm`
categories are deliberately left to humans — on a photography platform they fire
on scars and documentary/medical imagery far more often than on real violations.

## Turning it on

```bash
OPENAI_API_KEY="sk-..."
CONTENT_MODERATION_ENABLED="true"
```

Both are required. The flag on without a key falls back to `MockScanner` (the
old everything-to-humans behaviour) rather than silently scanning nothing while
looking enabled — `services/moderation.ts` checks both.

The Moderation endpoint is free and does not count toward API usage limits, so
there is no per-upload cost to weigh.

## Before enabling — the personal-data question

Turning this on sends **every uploaded portfolio image to OpenAI in the United
States**. Those images contain identifiable people, most of whom are not
Fgrapher users (they're the photographer's clients).

Two things follow, and neither is settled in code:

1. **Consent.** `ConsentPurpose` has no purpose covering third-party content
   moderation. `SERVICE` is the only one that could be stretched to fit, and
   stretching it is exactly the bundling that skill `fgrapher-compliance` §2
   says is invalid. If this is enabled for real users, the honest move is a new
   purpose (and the privacy policy text to match), not a reinterpretation of an
   existing one.
2. **Cross-border transfer.** Same class of question as the KYC images already
   sitting in Cloudinary (see `fgrapher-compliance` §6). A decision for the
   project owner, informed by a lawyer — not something a feature flag's default
   should quietly make.

The flag defaults to `false` for these reasons, not because the code is
unfinished.

## Failure behaviour

Every failure path returns "unknown", which routes to the human queue:

| Situation                              | Result                       |
| -------------------------------------- | ---------------------------- |
| No API key / flag off                  | `needs_review` (MockScanner) |
| Network error, non-2xx, malformed JSON | `needs_review`               |
| Timeout (10s)                          | `needs_review`               |
| Non-`http(s)` URL (blob:, data:)       | `needs_review`               |
| Video                                  | `needs_review`               |

The portfolio upload path calls `runModeration()` fire-and-forget, so none of
this can block or fail an upload. The avatar/cover path
(`/api/users/me` PATCH) awaits the scan inline and returns 422 on a flag —
that's why there's a 10s timeout at all.

## Where things are

| Thing                     | File                                        |
| ------------------------- | ------------------------------------------- |
| HTTP client               | `src/lib/openai-moderation.ts`              |
| Policy + scanner + wiring | `src/services/moderation.ts`                |
| Policy tests              | `src/services/__tests__/moderation.test.ts` |
| Human queue               | `src/app/(admin)/admin/moderation/`         |
| Upload call site          | `src/app/api/portfolio/route.ts`            |
| Avatar/cover call site    | `src/app/api/users/me/route.ts`             |

Audit trail, in the order it accumulates for a disputed photo:

| Event                       | `AuditLog.action`            | Written by                |
| --------------------------- | ---------------------------- | ------------------------- |
| Machine hid the photo       | `MEDIA_AUTO_REJECTED`        | `runModeration()`         |
| Admin rejected it           | `MEDIA_REJECTED`             | `moderateMedia()`         |
| Admin's reject cost a point | `USER_VIOLATION_POINT_ADDED` | `applyViolationStrikes()` |
| Third point suspended them  | `USER_AUTO_SUSPENDED`        | `applyViolationStrikes()` |

`MEDIA_AUTO_REJECTED` carries the category and score in `metadata`. A photo with
that row but no `MEDIA_REJECTED` after it was hidden by the machine and never
confirmed by a human — which is a queue backlog, not a decision.

## Never send KYC images here

ID and selfie images live in a separate Cloudinary folder with `authenticated`
delivery and are reachable only through short-lived signed URLs
(`generateKycSignedUrl`). They must never be passed to this scanner. The URL
guard in `moderateImageUrl()` is not what protects that — the fact that nothing
calls it with a KYC URL is. Keep it that way.
