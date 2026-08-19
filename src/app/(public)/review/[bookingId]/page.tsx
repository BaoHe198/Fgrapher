import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getReviewEligibility } from "@/services/reviews";
import { db } from "@/lib/db";

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
      provider: { select: { firstName: true, name: true, username: true } },
      service: { select: { name: true } },
    },
  });

  if (!booking) {
    redirect("/dashboard/bookings");
  }

  const providerName = booking.provider.firstName ?? booking.provider.name ?? "your provider";

  return (
    <ReviewPageContent
      bookingId={bookingId}
      providerName={providerName}
      providerUsername={booking.provider.username}
      serviceName={booking.service?.name}
      eligible={eligibility.eligible}
      reason={eligibility.eligible ? null : eligibility.reason}
    />
  );
}
