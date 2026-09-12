import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { buildMediaVariants } from "@/lib/media-variants";
import {
  type ImageCategory,
  type ModerationScores,
  isContentModerationConfigured,
  moderateImageUrl,
} from "@/lib/openai-moderation";
import { logAudit } from "@/services/compliance";

export interface ScanInput {
  url: string;
  publicId: string | null;
  // VIDEO is never sent to the image scanner — see OpenAIModerationScanner.
  // Optional because the avatar/cover call site (/api/users/me) only ever
  // deals with images.
  type?: "IMAGE" | "VIDEO";
}

export type ScanVerdict = "needs_review" | "flagged";

export interface ScanResult {
  verdict: ScanVerdict;
  reason?: string;
}

// Swap the scanner by changing contentScanner's assignment below — every
// call site depends on this interface, never on a concrete scanner.
export interface ContentScanner {
  scan(input: ScanInput): Promise<ScanResult>;
}

// Never auto-approves and never auto-flags — every upload it sees goes to
// the human moderation queue as PENDING. Still the behaviour whenever the
// automated tier is off or unconfigured, and what the tests run against.
export class MockScanner implements ContentScanner {
  async scan(): Promise<ScanResult> {
    return { verdict: "needs_review" };
  }
}

// Flag only above this score, NOT on OpenAI's own `flagged` boolean,
// which is calibrated to catch borderline content. A false positive is
// cheap here — it just moves an ordinary photo up the queue — but a queue
// where half the uploads wear an "attention" badge is a queue with no
// signal left in it, and the admin stops trusting the badge entirely.
// 0.9 is what keeps it meaning something.
const AUTO_FLAG_THRESHOLD = 0.9;

// Only these two are worth pulling to the front of a photography
// portfolio queue: sexual content (CLAUDE.md ràng buộc #3 — no nude/sexy/
// boudoir category exists at all, so it's out of scope for the product,
// not a judgement call) and graphic violence. The self-harm categories
// are excluded deliberately — on a photography platform they fire on
// things like scars or medical imagery in documentary work far more often
// than on actual violating content, so including them would be most of
// the noise for almost none of the signal.
const AUTO_FLAG_CATEGORIES: ImageCategory[] = ["sexual", "violence/graphic"];

// Pure, so the policy can be tested without touching the network — see
// services/__tests__/moderation.test.ts. `scores` null means the scan
// couldn't run (not configured, unreachable URL, API error, timeout);
// that is "unknown", and unknown always goes to a human.
export function verdictFromScores(scores: ModerationScores | null): ScanResult {
  if (!scores) return { verdict: "needs_review" };

  for (const category of AUTO_FLAG_CATEGORIES) {
    const score = scores.scores[category];
    if (score !== undefined && score >= AUTO_FLAG_THRESHOLD) {
      return {
        verdict: "flagged",
        reason: `Automated scan: ${category} (${score.toFixed(2)})`,
      };
    }
  }

  return { verdict: "needs_review" };
}

// A filter in front of the human queue, never a decision. "flagged" here
// means "an admin should look at this one first" — it is not a verdict,
// and runModeration() acts on it by writing a sort key and nothing else.
export class OpenAIModerationScanner implements ContentScanner {
  async scan(input: ScanInput): Promise<ScanResult> {
    // The endpoint takes images only. A video would need frame extraction
    // first, which nothing here does — so videos keep going straight to a
    // human, same as before.
    if (input.type === "VIDEO") return { verdict: "needs_review" };

    // Never the original. buildMediaVariants().moderation is a 512px
    // Cloudinary derivative with no EXIF — enough to classify, not enough
    // to identify, and no GPS/camera metadata leaves with it. See that
    // field's comment and docs/ops/content-moderation.md.
    const url = buildMediaVariants(input.url).moderation;

    return verdictFromScores(await moderateImageUrl(url));
  }
}

// Off unless BOTH the flag is on and a key is actually present, so a
// half-configured environment degrades to the human queue rather than
// silently scanning nothing while looking enabled.
export const contentScanner: ContentScanner =
  features.contentModerationEnabled && isContentModerationConfigured()
    ? new OpenAIModerationScanner()
    : new MockScanner();

// Runs right after a ProfileMedia row is created (see /api/portfolio's
// POST handler). The scanner's entire job is to SORT the admin's queue:
// a flagged photo stays PENDING like every other upload and just surfaces
// first at /admin/moderation, carrying the category+score that flagged it.
//
// It does not hide, reject, or penalise anything — project owner's
// decision, 12/09/2026. A machine narrows down what a person looks at
// first; a person decides what happens, and a separate deliberate admin
// action (after actually contacting the provider) is what records a
// violation. See services/admin.ts's addViolationPoint().
//
// Nothing here changes what is public: an upload is PENDING either way,
// and PENDING was never public.
export async function runModeration(mediaId: string) {
  const media = await db.profileMedia.findUniqueOrThrow({
    where: { id: mediaId },
    include: { profile: { select: { userId: true } } },
  });

  const result = await contentScanner.scan({
    url: media.url,
    publicId: media.publicId,
    type: media.type,
  });
  if (result.verdict !== "flagged") return;

  await db.profileMedia.update({
    where: { id: mediaId },
    data: {
      autoFlagReason: result.reason ?? "Flagged by automated content scan",
      autoFlaggedAt: new Date(),
    },
  });

  await logAudit({
    action: "MEDIA_AUTO_FLAGGED",
    targetType: "profile_media",
    targetId: mediaId,
    metadata: {
      userId: media.profile.userId,
      reason: result.reason,
    },
  });
}
