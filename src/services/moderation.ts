import { db } from "@/lib/db";
import { features } from "@/lib/features";
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

// Auto-reject only above this score, NOT on OpenAI's own `flagged`
// boolean. `flagged` uses OpenAI's calibration, which is tuned to catch
// borderline content — appropriate for "show a human", far too eager for
// an action that costs a provider a violation point and auto-suspends
// their account at three (see VIOLATION_POINTS_PER_AUTO_REJECT below).
// Anything under this still reaches a human; the only thing a lower
// threshold would buy is fewer admin reviews, at the price of wrongly
// suspending real photographers.
const AUTO_REJECT_THRESHOLD = 0.9;

// Only these two are grounds for an automatic reject on a photography
// portfolio: sexual content (CLAUDE.md ràng buộc #3 — no nude/sexy/
// boudoir category exists at all, so it's out of scope for the product,
// not a judgement call) and graphic violence. The self-harm categories
// are left to humans deliberately — on a photography platform they fire
// on things like scars or medical imagery in documentary work far more
// often than on actual violating content.
const AUTO_REJECT_CATEGORIES: ImageCategory[] = ["sexual", "violence/graphic"];

// Pure, so the policy can be tested without touching the network — see
// services/__tests__/moderation.test.ts. `scores` null means the scan
// couldn't run (not configured, unreachable URL, API error, timeout);
// that is "unknown", and unknown always goes to a human.
export function verdictFromScores(scores: ModerationScores | null): ScanResult {
  if (!scores) return { verdict: "needs_review" };

  for (const category of AUTO_REJECT_CATEGORIES) {
    const score = scores.scores[category];
    if (score !== undefined && score >= AUTO_REJECT_THRESHOLD) {
      return {
        verdict: "flagged",
        reason: `Automated scan: ${category} (${score.toFixed(2)})`,
      };
    }
  }

  return { verdict: "needs_review" };
}

// Tier 1 of a two-tier pipeline: this never approves anything. It either
// rejects outright (high-confidence violation) or defers to the human
// queue at /admin/moderation, which is where every upload already went
// before this existed. Adding it can only ever take work off the queue,
// never let something through unreviewed.
export class OpenAIModerationScanner implements ContentScanner {
  async scan(input: ScanInput): Promise<ScanResult> {
    // The endpoint takes images only. A video would need frame extraction
    // first, which nothing here does — so videos keep going straight to a
    // human, same as before.
    if (input.type === "VIDEO") return { verdict: "needs_review" };

    return verdictFromScores(await moderateImageUrl(input.url));
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
// POST handler) — scans it and, if flagged, moves it to AUTO_REJECTED so
// it can't reach the public profile. Anything not flagged is left PENDING
// for the human queue (/admin/moderation); this function never sets
// APPROVED itself.
//
// It deliberately does NOT add a violation point or suspend anyone. The
// project owner's call (12/09/2026): an automated scanner may hide a
// photo, but only a human may penalise an account — three points are an
// account suspension, and a model's mistake should never cost a real
// photographer their livelihood with nobody having looked. Strikes are
// awarded by moderateMedia() in services/admin.ts, on an admin's own
// reject. An AUTO_REJECTED photo a provider disputes is re-examined by an
// admin there, and that's where a penalty (if any) comes from.
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
      moderationStatus: "AUTO_REJECTED",
      moderationNote: result.reason ?? "Flagged by automated content scan",
      moderatedAt: new Date(),
    },
  });

  await logAudit({
    action: "MEDIA_AUTO_REJECTED",
    targetType: "profile_media",
    targetId: mediaId,
    metadata: {
      userId: media.profile.userId,
      reason: result.reason,
    },
  });
}
