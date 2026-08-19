import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getProviderReviewStats, listProviderReviews } from "@/services/reviews";

import { ReviewsDashboardContent } from "./reviews-dashboard-content";

export default async function DashboardReviewsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [stats, reviews] = await Promise.all([
    getProviderReviewStats(session.user.id),
    listProviderReviews({ providerId: session.user.id }),
  ]);

  return (
    <ReviewsDashboardContent
      stats={stats}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        response: r.response,
        createdAt: r.createdAt.toISOString(),
        reviewer: r.reviewer,
        serviceName: r.booking.service?.name ?? null,
      }))}
    />
  );
}
