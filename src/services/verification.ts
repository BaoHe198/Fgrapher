import { createHash } from "node:crypto";

import type { LegalEntityType, Role } from "@prisma/client";

import {
  deleteKycAsset,
  isCloudinaryConfigured,
  isOwnKycAsset,
  withoutDeliverySignature,
} from "@/lib/media/cloudinary";
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
  legalEntityType: LegalEntityType;
  businessDocUrl?: string;
  businessDocPublicId?: string;
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

const KYC_PUBLIC_ID_COLUMNS = [
  "verificationIdPublicId",
  "verificationIdBackPublicId",
  "verificationSelfiePublicId",
  "verificationBusinessDocPublicId",
] as const;

type KycPublicIds = Partial<
  Record<(typeof KYC_PUBLIC_ID_COLUMNS)[number], string | null>
>;

const KYC_COLUMNS_SELECT = {
  id: true,
  userId: true,
  verificationIdPublicId: true,
  verificationIdBackPublicId: true,
  verificationSelfiePublicId: true,
  verificationBusinessDocPublicId: true,
} as const;

const KYC_COLUMNS_CLEARED = {
  verificationIdUrl: null,
  verificationIdPublicId: null,
  verificationIdBackUrl: null,
  verificationIdBackPublicId: null,
  verificationSelfieUrl: null,
  verificationSelfiePublicId: null,
  verificationBusinessDocUrl: null,
  verificationBusinessDocPublicId: null,
  purgeAfter: null,
} as const;

/**
 * Deletes identity-document files from storage, now. Best effort per file: a
 * failure is logged and the rest still go, because every caller is in the
 * middle of something (a resubmission, a role removal, an account deletion)
 * that must not be undone by a storage hiccup.
 *
 * The 90-day cron used to be the only thing that ever deleted these files,
 * and it finds them through the UserRole columns. Three paths dropped those
 * columns while the files were still there — a resubmission overwrote them,
 * removing or changing a role deleted the row, and deleting an account left
 * them for up to 90 more days — so the documents outlived every reference
 * to them (CLAUDE.md rule 7). Each of those paths now calls this first.
 */
export async function deleteKycFiles(
  row: KycPublicIds,
  keep: readonly (string | null | undefined)[] = [],
) {
  if (!isCloudinaryConfigured()) return 0;
  const kept = new Set(keep.filter(Boolean));
  const publicIds = KYC_PUBLIC_ID_COLUMNS.map((column) => row[column]).filter(
    (publicId): publicId is string => Boolean(publicId) && !kept.has(publicId),
  );
  let deleted = 0;
  for (const publicId of new Set(publicIds)) {
    try {
      await deleteKycAsset(publicId);
      deleted += 1;
    } catch (error) {
      console.error("[KYC] Could not delete an identity document", {
        publicId,
        error,
      });
    }
  }
  return deleted;
}

/**
 * Removes the identity documents of roles that are going away or whose
 * owner is being erased: deletes the files, clears the columns, and writes
 * the same audit entry the cron writes. The verification outcome
 * (status, verifiedAt, verifiedBy, idNumberHash) is left alone.
 */
export async function purgeKycDocumentsNow(
  where: { userId: string; role?: Role },
  reason: "role_removed" | "account_deleted",
) {
  const rows = await db.userRole.findMany({
    where: {
      ...where,
      OR: KYC_PUBLIC_ID_COLUMNS.map((column) => ({ [column]: { not: null } })),
    },
    select: KYC_COLUMNS_SELECT,
  });
  for (const row of rows) {
    await deleteKycFiles(row);
    await db.userRole.update({
      where: { id: row.id },
      data: KYC_COLUMNS_CLEARED,
    });
    await logAudit({
      action: "KYC_DOCUMENTS_PURGED",
      targetType: "user_role",
      targetId: row.id,
      metadata: { userId: row.userId, reason },
    });
  }
  return rows.length;
}

export async function submitVerification({
  userId,
  role,
  legalEntityType,
  businessDocUrl,
  businessDocPublicId,
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

  // Every document must be this user's own upload (fgrapher-kyc/<userId>/).
  const documents: [string | undefined, string | undefined][] = [
    [idFrontPublicId, idFrontUrl],
    [idBackPublicId, idBackUrl],
    [selfiePublicId, selfieUrl],
    [businessDocPublicId, businessDocUrl],
  ];
  for (const [publicId, url] of documents) {
    if (publicId && !isOwnKycAsset(userId, publicId, url)) {
      throw new VerificationError("Uploaded documents could not be verified");
    }
  }

  const updated = await db.userRole.update({
    where: { id: userRole.id },
    data: {
      verificationStatus: "PENDING",
      // Recorded with the submission, not asked again later: what the
      // provider declares here is what the reviewer checks the documents
      // against.
      legalEntityType,
      legalEntityConfirmedAt: new Date(),
      // Stored without their delivery signature — see
      // withoutDeliverySignature.
      verificationBusinessDocUrl: businessDocUrl
        ? withoutDeliverySignature(businessDocUrl)
        : null,
      verificationBusinessDocPublicId: businessDocPublicId ?? null,
      verificationIdUrl: withoutDeliverySignature(idFrontUrl),
      verificationIdPublicId: idFrontPublicId,
      verificationIdBackUrl: withoutDeliverySignature(idBackUrl),
      verificationIdBackPublicId: idBackPublicId,
      verificationSelfieUrl: withoutDeliverySignature(selfieUrl),
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

  // A resubmission after a rejection: the files of the earlier attempt
  // are no longer referenced by anything, so they go now.
  await deleteKycFiles(userRole, [
    idFrontPublicId,
    idBackPublicId,
    selfiePublicId,
    businessDocPublicId,
  ]);

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
      verificationBusinessDocPublicId: true,
    },
  });

  for (const row of due) {
    await Promise.all(
      [
        row.verificationIdPublicId,
        row.verificationIdBackPublicId,
        row.verificationSelfiePublicId,
        // A business registration certificate is personal data on the same
        // 90-day clock as the ID card — it must not outlive it.
        row.verificationBusinessDocPublicId,
      ]
        .filter((publicId): publicId is string => Boolean(publicId))
        .map((publicId) => deleteKycAsset(publicId)),
    );

    await db.userRole.update({
      where: { id: row.id },
      data: KYC_COLUMNS_CLEARED,
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
