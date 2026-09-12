# Content moderation — an automated filter in front of a human queue

## The shape of it

Every portfolio upload lands in the queue at `/admin/moderation` as `PENDING`,
and nothing becomes public until an admin approves it
(`ProfileMedia.moderationStatus`, enforced at the query layer by
`services/search.ts` and at publish time by `setProfilePublished()`).

The automated tier does not change that in any way. **It sorts the queue. It
does not decide anything.**

```
upload → ProfileMedia created (PENDING)
       → runModeration() [fire-and-forget]
           → OpenAI omni-moderation-latest, on a 512px derivative
               → score ≥ 0.9 on sexual | violence/graphic
                     → autoFlagReason + autoFlaggedAt set
                        → still PENDING, just first in the admin queue,
                          badged with the category and score
               → anything else, or the scan couldn't run
                     → nothing written at all
```

Three properties hold by construction, and are what the design is for:

1. **It never approves anything.** Only an admin can.
2. **It never hides or rejects anything.** A flagged photo is exactly as pending
   as every other upload.
3. **It never penalises anyone.** Violation points come from one deliberate
   admin action, described below.

The worst case of a wrong automated answer is an admin looking at an ordinary
photo slightly sooner than they otherwise would.

## Who can penalise an account

Only an admin, by hand, at `/admin/users/[id]` → "Record a violation" →
`addViolationPoint()` in `services/admin.ts`. Project owner's decision,
12/09/2026.

Specifically **not** penalties:

- the scanner flagging a photo — it only reorders the queue
- an admin **rejecting** a photo in `moderateMedia()` — that hides the photo and
  emails the provider the reason, and stops there

The intended sequence is: scan flags → admin reviews → admin rejects if it
breaks the rules → admin contacts and warns the provider → **only then**, if
warranted, the admin records a violation. A rejected photo is usually a
misunderstanding about the rules rather than misconduct, so the two are not the
same click.

A reason is required to record one, and it goes into `AuditLog` — a point nobody
can later explain is worthless when the provider appeals.

The third point still suspends the account automatically, because that is what
`/guidelines` tells users happens. It is not a surprise to the admin either: the
current count and an explicit "this would be the 3rd" warning sit next to the
button, and "Clear all points" and "Unsuspend" are both one click away.

## What crosses the border, and what doesn't

The scanner is sent **a 512px Cloudinary derivative, never the uploaded
original** — `buildMediaVariants(url).moderation` in `lib/media-variants.ts`.

That matters for two reasons:

- **No metadata travels.** A Cloudinary transformation re-encodes the file, so
  no EXIF goes with it — no GPS coordinates of where the shoot happened, no
  camera serial, no capture timestamp.
- **512px classifies but doesn't identify.** It is ample for "is this sexual or
  graphic" and far too small to be useful for recognising a person.

What this does **not** do is make the transfer stop being a transfer. See below.

## Where the data actually lives (checked, not assumed)

| Component      | Region                                              |
| -------------- | --------------------------------------------------- |
| App compute    | Singapore — `vercel.json` `"regions": ["sin1"]`     |
| Database       | Singapore — Supabase `aws-0-ap-southeast-1`         |
| Image storage  | Cloudinary — **region not verified from this repo** |
| Automated scan | OpenAI, United States                               |

So the app and its database are already deliberately close to Vietnam, not in
the US. Cloudinary's region depends on the account and could not be confirmed
from the code — worth checking in the Cloudinary console, because if portfolio
images are already stored in the US, that is a far larger and more permanent
transfer than a 512px copy sent for a moderation verdict.

**Honest limit: no amount of code moves the OpenAI call inside Vietnam.** The
options that genuinely would are infrastructure decisions, not code changes:

1. **A Vietnamese moderation vendor** (VNPT, FPT.AI both offer content
   moderation). The `ContentScanner` interface in `services/moderation.ts`
   exists exactly so a second implementation can drop in beside
   `OpenAIModerationScanner` without touching a single call site. This is the
   cleanest path if residency has to hold.
2. **A self-hosted classifier** (an ONNX NSFW model) running on infrastructure
   in Vietnam. Removes the third party entirely; adds hosting the app doesn't
   currently have.
3. **Leave the automated tier off.** The human queue works exactly as it always
   has — this whole feature only reorders it.

## Before enabling — the consent question

`ConsentPurpose` has no purpose covering "sending your uploads to a third-party
content classifier". `SERVICE` is the only one that could be stretched to fit,
and stretching it is the bundling that skill `fgrapher-compliance` §2 says is
invalid.

If this is switched on for real users, the honest move is a new
`ConsentPurpose` value plus matching privacy-policy text naming OpenAI as a
processor — not a reinterpretation of an existing purpose. That is a lawyer's
call informed by the project owner, which is why the flag defaults to `false`
rather than because the code is unfinished.

## Turning it on

```bash
OPENAI_API_KEY="sk-..."
CONTENT_MODERATION_ENABLED="true"
```

Both are required. The flag on without a key falls back to `MockScanner` rather
than silently scanning nothing while looking enabled —
`services/moderation.ts` checks both.

The Moderation endpoint is free and does not count toward API usage limits, so
there is no per-upload cost to weigh.

## What it cannot detect — read this before trusting it

`sexual/minors` is a **text-only** category in OpenAI's Moderation API. It is
not evaluated for image input at all. So this scanner **cannot detect a minor in
a photo** — the single case CLAUDE.md's ràng buộc #3 and #4 care most about, and
the one behind the "Appears to be a minor" report reason.

That detection is entirely human review and user reports. An automated tier
existing must not be read as covering it.

Categories OpenAI does evaluate for images: `sexual`, `violence`,
`violence/graphic`, `self-harm`, `self-harm/intent`, `self-harm/instructions`.
Source: <https://developers.openai.com/api/docs/guides/moderation>

Also never flagged:

- **Videos.** `ProfileMedia.type === "VIDEO"` skips the scan entirely — the
  endpoint takes images only and nothing here extracts frames.
- **Anything below 0.9.** See the threshold note below.

## Why the threshold is 0.9 and not OpenAI's own `flagged`

The API returns its own `flagged` boolean, calibrated to catch borderline
content. Since a flag now only reorders a queue, a false positive is cheap — but
a queue where half the uploads are "urgent" is a queue with no signal in it, and
the admin stops trusting the badge. 0.9 keeps the badge meaningful.

Only `sexual` and `violence/graphic` are flagging grounds. The `self-harm`
categories are deliberately excluded — on a photography platform they fire on
scars and documentary/medical imagery far more often than on real violations.

The constants are `AUTO_FLAG_THRESHOLD` and `AUTO_FLAG_CATEGORIES` in
`services/moderation.ts`.

## Failure behaviour

Every failure path means "no flag written", which leaves the photo in the queue
in plain date order — exactly where it would have been with no scanner at all:

| Situation                              | Result  |
| -------------------------------------- | ------- |
| No API key / flag off                  | no flag |
| Network error, non-2xx, malformed JSON | no flag |
| Timeout (10s)                          | no flag |
| Non-`http(s)` URL (blob:, data:)       | no flag |
| Video                                  | no flag |

The portfolio upload path calls `runModeration()` fire-and-forget, so none of
this can block or fail an upload.

One exception worth knowing: the **avatar/cover** path (`/api/users/me` PATCH)
still awaits the scan inline and refuses the upload with a 422 if it flags.
Avatars deliberately skip the moderation queue entirely (they appear
immediately), so there is no human step to defer to — without the inline check
they would be completely unmoderated. Refusing an upload is not a penalty:
nothing is recorded, and the user simply picks another photo. That is why there
is a 10s timeout.

## Where things are

| Thing                     | File                                          |
| ------------------------- | --------------------------------------------- |
| HTTP client               | `src/lib/openai-moderation.ts`                |
| Downscaled derivative     | `src/lib/media-variants.ts` (`.moderation`)   |
| Policy + scanner + wiring | `src/services/moderation.ts`                  |
| Violation points          | `src/services/admin.ts` (`addViolationPoint`) |
| Tests                     | `src/services/__tests__/moderation.test.ts`   |
| Human queue               | `src/app/(admin)/admin/moderation/`           |
| Admin violation UI        | `src/app/(admin)/admin/users/[id]/`           |
| Upload call site          | `src/app/api/portfolio/route.ts`              |
| Avatar/cover call site    | `src/app/api/users/me/route.ts`               |

Audit trail:

| Event                   | `AuditLog.action`                   | Written by               |
| ----------------------- | ----------------------------------- | ------------------------ |
| Scan flagged a photo    | `MEDIA_AUTO_FLAGGED`                | `runModeration()`        |
| Admin approved/rejected | `MEDIA_APPROVED` / `MEDIA_REJECTED` | `moderateMedia()`        |
| Admin recorded a point  | `USER_VIOLATION_POINT_ADDED`        | `addViolationPoint()`    |
| Third point suspended   | `USER_AUTO_SUSPENDED`               | `addViolationPoint()`    |
| Admin cleared points    | `USER_VIOLATION_POINTS_CLEARED`     | `clearViolationPoints()` |

## Never send KYC images here

ID and selfie images live in a separate Cloudinary folder with `authenticated`
delivery, reachable only through short-lived signed URLs
(`generateKycSignedUrl`). They must never be passed to this scanner. The URL
guard in `moderateImageUrl()` is not what protects that — the fact that nothing
calls it with a KYC URL is. Keep it that way.
