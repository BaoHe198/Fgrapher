import { getTranslations } from "next-intl/server";

import { getUnreviewedCompletedBookings } from "@/services/reviews";

import { ReviewReminderBannerClient } from "./review-reminder-banner-client";

// Project owner's decision (not in the original G5 doc, added alongside it):
// after a booking completes, prompt the customer to review the provider.
// Chosen shape — a prominent but non-blocking dashboard banner, reappearing
// on every dashboard page load until the customer actually reviews, rather
// than a hard gate on other actions (see the "Để sau" dismiss in the client
// half: it only hides for the current view, since this Server Component
// re-queries and re-renders fresh on every navigation).
export async function ReviewReminderBanner({ userId }: { userId: string }) {
  const bookings = await getUnreviewedCompletedBookings(userId);
  if (bookings.length === 0) return null;

  const oldest = bookings[0];
  const t = await getTranslations("sharedComponents.reviewReminderBanner");

  return (
    <ReviewReminderBannerClient
      message={t("message", {
        count: bookings.length,
        provider: oldest.provider.firstName ?? oldest.provider.name ?? "",
      })}
      ctaLabel={t("cta")}
      dismissLabel={t("dismiss")}
      ctaHref={`/review/${oldest.id}`}
    />
  );
}
