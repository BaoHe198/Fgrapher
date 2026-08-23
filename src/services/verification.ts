import { createHash } from "node:crypto";

import type { Role } from "@prisma/client";

import { CURRENT_POLICY_VERSION } from "@/lib/constants";
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
