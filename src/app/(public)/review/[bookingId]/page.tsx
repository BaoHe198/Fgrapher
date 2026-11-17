import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getReviewEligibility } from "@/services/reviews";
import { db } from "@/lib/db";
import { resolvePartyName } from "@/lib/party-name";
import { PAID_ROLES } from "@/lib/constants";

import { ReviewPageContent } from "./review-page-content";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/review/${bookingId}`);
  }

  const eligibility = await getReviewEligibility(bookingId, session.user.id);

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      provider: {
        select: {
          firstName: true,
          name: true,
          username: true,
          avatar: true,
          profiles: {
            where: { role: { in: PAID_ROLES } },
            select: {
              displayName: true,
              role: true,
              // One approved photo of their work for the page's booking
              // card, the way Airbnb's review page shows the listing.
              media: {
                where: {
                  moderationStatus: "APPROVED",
                  deletedAt: null,
                  type: "IMAGE",
                },
                orderBy: { order: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
      service: { select: { name: true } },
    },
  });

  if (!booking) {
    redirect("/dashboard/bookings");
  }

  const providerName = resolvePartyName(booking.provider, "your provider");

  return (
    <ReviewPageContent
      bookingId={bookingId}
      providerName={providerName}
      providerUsername={booking.provider.username}
      serviceName={booking.service?.name}
      shootDate={booking.date.toISOString()}
      photoUrl={
        booking.provider.profiles.find((p) => p.media.length > 0)?.media[0]
          ?.url ??
        booking.provider.avatar ??
        null
      }
      eligible={eligibility.eligible}
      reason={eligibility.eligible ? null : eligibility.reason}
    />
  );
}
