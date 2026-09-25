import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePartyName } from "@/lib/party-name";
import { OfferError, getOpportunityDetail } from "@/services/request-offers";

import { OpportunityDetail } from "./opportunity-detail";

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const t = await getTranslations("dashboardCore.opportunities.detail");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const { role } = await searchParams;
  // Links from notifications and emails carry only the request id. The
  // request itself says which role it wants; use that when this provider
  // holds it, instead of a "page not found".
  if (!role) {
    const request = await db.serviceRequest.findUnique({
      where: { id },
      select: { role: true },
    });
    if (request && session.user.roles.includes(request.role)) {
      redirect(`/dashboard/opportunities/${id}?role=${request.role}`);
    }
    notFound();
  }

  let request;
  try {
    request = await getOpportunityDetail(id, session.user.id, role as Role);
  } catch (err) {
    if (err instanceof OfferError) notFound();
    throw err;
  }

  const myOffer = request.offers[0] ?? null;

  return (
    <OpportunityDetail
      backLabel={t("back")}
      role={role as Role}
      request={{
        id: request.id,
        code: request.code,
        title: request.title,
        description: request.description,
        categories: request.categories,
        shootDate: request.shootDate?.toISOString() ?? null,
        isDateFlexible: request.isDateFlexible,
        dateRangeStart: request.dateRangeStart?.toISOString() ?? null,
        dateRangeEnd: request.dateRangeEnd?.toISOString() ?? null,
        province: request.province.name,
        ward: request.ward?.name ?? null,
        areaNote: request.areaNote,
        budgetMin: request.budgetMin,
        budgetMax: request.budgetMax,
        references: request.references,
        customerName: resolvePartyName(request.customer, ""),
      }}
      myOffer={
        myOffer
          ? {
              id: myOffer.id,
              status: myOffer.status,
              message: myOffer.message,
              proposedPrice: myOffer.proposedPrice,
              proposedDate: myOffer.proposedDate?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
