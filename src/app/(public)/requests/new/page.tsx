import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { listProvinces } from "@/services/geography";

import { RequestWizard } from "./request-wizard";

export default async function NewServiceRequestPage({
  searchParams,
}: {
  /** draft: resume a saved draft. copy: "Đăng lại yêu cầu này" - a new
   * request prefilled from one of the customer's own (expired) requests. */
  searchParams: Promise<{ draft?: string; copy?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/requests/new")}`);
  }

  const { draft: draftParam, copy: copyId } = await searchParams;
  const draftId = draftParam ?? copyId;
  const isCopy = !draftParam && Boolean(copyId);

  const [user, provinces, draft] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { phoneVerified: true, phone: true },
    }),
    listProvinces(),
    draftId
      ? db.serviceRequest.findUnique({
          where: { id: draftId },
          include: { references: true },
        })
      : null,
  ]);

  if (
    draftId &&
    (!draft ||
      draft.customerId !== session.user.id ||
      (!isCopy && !draft.isDraft))
  ) {
    redirect("/dashboard/requests");
  }

  return (
    <RequestWizard
      userId={session.user.id}
      // Twilio isn't paid/configured yet — while PHONE_VERIFICATION_REQUIRED
      // is off, skip the client-side verify-phone gate too (the server-side
      // check in services/service-requests.ts is skipped the same way, so
      // this just keeps the UI from blocking on a step the API wouldn't
      // enforce anyway).
      phoneVerified={
        features.phoneVerificationRequired ? user.phoneVerified : true
      }
      phone={user.phone}
      provinces={provinces.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      }))}
      draft={
        draft
          ? {
              // A copy starts a new request: no id, so nothing is saved
              // over the old one, and no reference files, which belong to it.
              id: isCopy ? "" : draft.id,
              title: draft.title,
              description: draft.description,
              role: draft.role,
              categories: draft.categories,
              shootDate: draft.shootDate?.toISOString().slice(0, 10) ?? null,
              isDateFlexible: draft.isDateFlexible,
              dateRangeStart:
                draft.dateRangeStart?.toISOString().slice(0, 10) ?? null,
              dateRangeEnd:
                draft.dateRangeEnd?.toISOString().slice(0, 10) ?? null,
              provinceId: draft.provinceId,
              wardId: draft.wardId,
              areaNote: draft.areaNote,
              detailedAddress: draft.detailedAddress,
              budgetMin: draft.budgetMin,
              budgetMax: draft.budgetMax,
              references: (isCopy ? [] : draft.references).map((r) => ({
                mediaUrl: r.mediaUrl,
                publicId: r.publicId ?? "",
              })),
            }
          : null
      }
    />
  );
}
