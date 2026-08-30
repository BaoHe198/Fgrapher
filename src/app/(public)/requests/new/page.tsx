import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listProvinces } from "@/services/geography";

import { RequestWizard } from "./request-wizard";

export default async function NewServiceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { draft: draftId } = await searchParams;

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
    (!draft || draft.customerId !== session.user.id || !draft.isDraft)
  ) {
    redirect("/dashboard/requests");
  }

  return (
    <RequestWizard
      phoneVerified={user.phoneVerified}
      phone={user.phone}
      provinces={provinces.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      }))}
      draft={
        draft
          ? {
              id: draft.id,
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
              references: draft.references.map((r) => ({
                mediaUrl: r.mediaUrl,
                publicId: r.publicId ?? undefined,
              })),
            }
          : null
      }
    />
  );
}
