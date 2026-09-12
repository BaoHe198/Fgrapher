# Content moderation — tier 1 (automated) + tier 2 (human)

## The shape of it

Every portfolio upload has always landed in the human queue at
`/admin/moderation` as `PENDING`, and nothing becomes public until an admin
approves it (`ProfileMedia.moderationStatus`, enforced at the query layer by
`services/search.ts` and at publish time by `setProfilePublished()`).

Tier 1 does not change that contract. It only removes clear violations from the
queue before a human ever sees them:

```
upload → ProfileMedia created (PENDING)
       → runModeration() [fire-and-forget]
           → OpenAI omni-moderation-latest
               → score ≥ 0.9 on sexual | violence/graphic
                     → AUTO_REJECTED + 1 violation point
                        (3 points = automatic account suspension)
               → anything else, or the scan couldn't run
                     → stays PENDING → human queue
```

**Tier 1 never approves anything.** The worst case of a wrong automated answer
is extra work for a human, never unreviewed content going public. This is the
property the whole design rests on, and `services/__tests__/moderation.test.ts`
asserts it directly.

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

## Why the threshold is 0.9 and not OpenAI's own `flagged`

The API returns its own `flagged` boolean, calibrated to catch borderline
content. That calibration is right for "show this to a human" and much too eager
for what an auto-reject actually does here: it adds a violation point, and three
points automatically suspend the provider's account.

So the policy reads `category_scores` and requires ≥ 0.9, ignoring `flagged`
entirely. A lower threshold would buy fewer admin reviews at the price of
wrongly suspending real photographers. The constant is `AUTO_REJECT_THRESHOLD`
in `services/moderation.ts`.

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

Every auto-reject writes an `AuditLog` row (`MEDIA_AUTO_REJECTED`) with the
category and score in `metadata`, and an automatic suspension writes
`USER_AUTO_SUSPENDED`. Those are the rows to read when a provider disputes a
rejection.

## Never send KYC images here

ID and selfie images live in a separate Cloudinary folder with `authenticated`
delivery and are reachable only through short-lived signed URLs
(`generateKycSignedUrl`). They must never be passed to this scanner. The URL
guard in `moderateImageUrl()` is not what protects that — the fact that nothing
calls it with a KYC URL is. Keep it that way.
