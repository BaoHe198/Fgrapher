import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { resolvePartyName } from "@/lib/party-name";
import {
  ServiceRequestError,
  getOfferProviderExtras,
  getServiceRequestForCustomer,
} from "@/services/service-requests";

import { RequestDetail } from "./request-detail";

// Whole days left before an open request expires, rounded up ("còn 1
// ngày" until the last hour).
function daysUntil(expiresAt: Date) {
  return Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000),
  );
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("dashboardCore.serviceRequests.detail");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  let request;
  try {
    request = await getServiceRequestForCustomer(id, session.user.id);
  } catch (err) {
    if (err instanceof ServiceRequestError) notFound();
    throw err;
  }

  if (request.isDraft) {
    redirect(`/requests/new?draft=${request.id}`);
  }

  const extras = await getOfferProviderExtras(
    request.offers.map((offer) => offer.provider.id),
    request.role,
  );

  return (
    <RequestDetail
      backLabel={t("back")}
      request={{
        id: request.id,
        code: request.code,
        title: request.title,
        description: request.description,
        role: request.role,
        categories: request.categories,
        status: request.status,
        shootDate: request.shootDate?.toISOString() ?? null,
        isDateFlexible: request.isDateFlexible,
        dateRangeStart: request.dateRangeStart?.toISOString() ?? null,
        dateRangeEnd: request.dateRangeEnd?.toISOString() ?? null,
        province: request.province.name,
        ward: request.ward?.name ?? null,
        areaNote: request.areaNote,
        budgetMin: request.budgetMin,
        budgetMax: request.budgetMax,
        moderationReason: request.moderationReason,
        daysLeft: daysUntil(request.expiresAt),
        references: request.references,
        offers: request.offers.map((offer) => ({
          id: offer.id,
          status: offer.status,
          message: offer.message,
          proposedPrice: offer.proposedPrice,
          proposedDate: offer.proposedDate?.toISOString() ?? null,
          createdAt: offer.createdAt.toISOString(),
          provider: {
            id: offer.provider.id,
            name: resolvePartyName(offer.provider, "", request.role),
            avatar: offer.provider.avatar,
            username: offer.provider.username,
            verified: offer.provider.roles.some(
              (r) =>
                r.role === request.role && r.verificationStatus === "VERIFIED",
            ),
            ...(extras.get(offer.provider.id) ?? {
              avgRating: null,
              reviewCount: 0,
              samples: [],
            }),
          },
        })),
      }}
    />
  );
}
