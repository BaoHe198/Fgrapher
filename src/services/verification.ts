import { createHash } from "node:crypto";

import type { Role } from "@prisma/client";

import { deleteKycAsset, isCloudinaryConfigured } from "@/lib/cloudinary";
import { CURRENT_POLICY_VERSION, KYC_PURGE_AFTER_DAYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { logAudit, recordConsent } from "@/services/compliance";

export class VerificationError extends Error {}

// SHA-256 of the raw ID number — used only to detect duplicate submissions
// across accounts; the plaintext number itself is never persisted
// anywhere (see prisma/schema.prisma's UserRole comment).
function hashIdNumber(idNumber: string) {
  return createHash("sha256").update(idNumber).digest("hex");
}

interface SubmitVerificationInput {
  userId: string;
  role: Role;
  idNumber: string;
  idFrontUrl: string;
  idFrontPublicId: string;
  idBackUrl: string;
  idBackPublicId: string;
  selfieUrl: string;
  selfiePublicId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function submitVerification({
  userId,
  role,
  idNumber,
  idFrontUrl,
  idFrontPublicId,
  idBackUrl,
  idBackPublicId,
  selfieUrl,
  selfiePublicId,
  ipAddress,
  userAgent,
}: SubmitVerificationInput) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!userRole) {
    throw new VerificationError("You don't hold this role");
  }
  if (
    userRole.verificationStatus === "PENDING" ||
    userRole.verificationStatus === "VERIFIED"
  ) {
    throw new VerificationError(
      "This role is already verified or under review",
    );
  }

  const updated = await db.userRole.update({
    where: { id: userRole.id },
    data: {
      verificationStatus: "PENDING",
      verificationIdUrl: idFrontUrl,
      verificationIdPublicId: idFrontPublicId,
      verificationIdBackUrl: idBackUrl,
      verificationIdBackPublicId: idBackPublicId,
      verificationSelfieUrl: selfieUrl,
      verificationSelfiePublicId: selfiePublicId,
      idNumberHash: hashIdNumber(idNumber),
      verificationRejectedReason: null,
      // Set here too, not just on review (services/admin.ts's
      // reviewVerification) — a submission an admin never gets to (stuck
      // PENDING) still needs to hit the 90-day auto-delete cron.
      // reviewVerification overwrites this with a fresh window on
      // approval/rejection, so this is only ever the effective deadline
      // for the never-reviewed case.
      purgeAfter: new Date(Date.now() + KYC_PURGE_AFTER_DAYS * 86_400_000),
    },
  });

  await recordConsent({
    userId,
    purpose: "IDENTITY_VERIFICATION",
    granted: true,
    policyVersion: CURRENT_POLICY_VERSION,
    ipAddress,
    userAgent,
  });
  await logAudit({
    actorId: userId,
    action: "KYC_SUBMITTED",
    targetType: "user_role",
    targetId: updated.id,
    ipAddress,
    userAgent,
  });

  return updated;
}

// Daily cron (see /api/cron/purge-kyc-documents) — deletes the three KYC
// images from Cloudinary and nulls their URL/publicId columns 90 days
// after approval (UserRole.purgeAfter, set by services/admin.ts's
// reviewVerification). verificationStatus/verifiedAt/verifiedBy/
// idNumberHash are deliberately left untouched — they're the permanent
// audit trail that a verification happened, independent of whether the
// source images still exist.
export async function purgeExpiredKycDocuments() {
  // Unlike the upload/signed-URL helpers (pure local signature math),
  // cloudinary.uploader.destroy() throws synchronously without
  // credentials — no-op the whole run rather than nulling out DB columns
  // for images that were never actually deleted from anywhere.
  if (!isCloudinaryConfigured()) return 0;

  const due = await db.userRole.findMany({
    where: {
      purgeAfter: { lt: new Date() },
      verificationIdUrl: { not: null },
    },
    select: {
      id: true,
      userId: true,
      verificationIdPublicId: true,
      verificationIdBackPublicId: true,
      verificationSelfiePublicId: true,
    },
  });

  for (const row of due) {
    await Promise.all(
      [
        row.verificationIdPublicId,
        row.verificationIdBackPublicId,
        row.verificationSelfiePublicId,
      ]
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteKycAsset(publicId)),
    );

    await db.userRole.update({
      where: { id: row.id },
      data: {
        verificationIdUrl: null,
        verificationIdPublicId: null,
        verificationIdBackUrl: null,
        verificationIdBackPublicId: null,
        verificationSelfieUrl: null,
        verificationSelfiePublicId: null,
        purgeAfter: null,
      },
    });

    // No human actor — a system/cron action, matching AuditLog's nullable
    // actorId design for exactly this case.
    await logAudit({
      action: "KYC_DOCUMENTS_PURGED",
      targetType: "user_role",
      targetId: row.id,
      metadata: { userId: row.userId },
    });
  }

  return due.length;
}
