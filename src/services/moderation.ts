import { db } from "@/lib/db";
import { logAudit } from "@/services/compliance";

export interface ScanInput {
  url: string;
  publicId: string | null;
}

export type ScanVerdict = "needs_review" | "flagged";

export interface ScanResult {
  verdict: ScanVerdict;
  reason?: string;
}

// Swap the scanner by changing contentScanner's assignment below — every
// call site depends on this interface, never on MockScanner directly.
export interface ContentScanner {
  scan(input: ScanInput): Promise<ScanResult>;
}

// Never auto-approves and never auto-flags — every upload it sees goes to
// the human moderation queue as PENDING. This is the safe default until a
// real scanner (Cloudinary AI Moderation, AWS Rekognition, etc.) is
// plugged in via a different ContentScanner implementation.
export class MockScanner implements ContentScanner {
  async scan(): Promise<ScanResult> {
    return { verdict: "needs_review" };
  }
}

export const contentScanner: ContentScanner = new MockScanner();

// Points added to User.violationPoints per AUTO_REJECTED upload — the
// 3-strikes account-suspension policy documented on /guidelines treats 3
// as the auto-suspend threshold, so a single flagged upload is one strike.
const VIOLATION_POINTS_PER_AUTO_REJECT = 1;
const SUSPENSION_THRESHOLD = 3;

// Runs right after a ProfileMedia row is created (see /api/portfolio's
// POST handler) — scans it and, if flagged, immediately moves it to
// AUTO_REJECTED and adds a strike to the uploader's account, auto-
// suspending at the 3-strike threshold. Anything not flagged is left
// PENDING for the human queue (/admin/moderation) — this function never
// sets APPROVED itself.
export async function runModeration(mediaId: string) {
  const media = await db.profileMedia.findUniqueOrThrow({
    where: { id: mediaId },
    include: { profile: { select: { userId: true } } },
  });

  const result = await contentScanner.scan({
    url: media.url,
    publicId: media.publicId,
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

  const user = await db.user.update({
    where: { id: media.profile.userId },
    data: { violationPoints: { increment: VIOLATION_POINTS_PER_AUTO_REJECT } },
  });

  await logAudit({
    action: "MEDIA_AUTO_REJECTED",
    targetType: "profile_media",
    targetId: mediaId,
    metadata: {
      userId: media.profile.userId,
      reason: result.reason,
      violationPoints: user.violationPoints,
    },
  });

  if (user.violationPoints >= SUSPENSION_THRESHOLD && !user.isSuspended) {
    await db.user.update({
      where: { id: user.id },
      data: {
        isSuspended: true,
        suspendedReason:
          "Automatic suspension — 3 content violations (see /guidelines)",
      },
    });
    await logAudit({
      action: "USER_AUTO_SUSPENDED",
      targetType: "user",
      targetId: user.id,
      metadata: { violationPoints: user.violationPoints },
    });
  }
}
