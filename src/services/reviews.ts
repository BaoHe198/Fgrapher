import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { newReviewEmailHtml, reviewResponseEmailHtml } from "@/lib/email";
import { notify } from "@/services/notification";

const EDIT_WINDOW_DAYS = 7;
const RESPONSE_EDIT_WINDOW_HOURS = 24;
const REVIEW_WINDOW_DAYS = 30;

export class ReviewError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

function partyName(party: { firstName: string | null; name: string | null }) {
  return party.firstName ?? party.name ?? "there";
}

function bookingUrlFor(bookingId: string) {
  return `${process.env.NEXTAUTH_URL ?? ""}/dashboard/bookings/${bookingId}`;
}

export async function getReviewEligibility(bookingId: string, userId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { review: true },
  });

  if (!booking || booking.customerId !== userId) {
    return { eligible: false as const, reason: "not_found" as const };
  }
  if (booking.status !== "COMPLETED") {
    return { eligible: false as const, reason: "not_completed" as const };
  }
  if (booking.review) {
    return {
      eligible: false as const,
      reason: "already_reviewed" as const,
      review: booking.review,
    };
  }
  if (!booking.completedAt) {
    return { eligible: false as const, reason: "not_completed" as const };
  }
  const daysSinceCompletion =
    (Date.now() - booking.completedAt.getTime()) / 86_400_000;
  if (daysSinceCompletion > REVIEW_WINDOW_DAYS) {
    return { eligible: false as const, reason: "window_expired" as const };
  }

  return { eligible: true as const, booking };
}

// Prompt G5 aside (project owner's C4 decision, not in the original doc):
// a non-blocking dashboard reminder for customers with completed bookings
// they haven't reviewed yet — see components/layout/review-reminder-banner.tsx.
// Same eligibility rules as getReviewEligibility (COMPLETED, no Review row,
// within REVIEW_WINDOW_DAYS), just listed across all of a customer's
// bookings instead of checked for one.
export async function getUnreviewedCompletedBookings(userId: string) {
  return db.booking.findMany({
    where: {
      customerId: userId,
      status: "COMPLETED",
      completedAt: {
        gte: new Date(Date.now() - REVIEW_WINDOW_DAYS * 86_400_000),
      },
      review: null,
    },
    include: {
      provider: { select: { firstName: true, name: true } },
      service: { select: { name: true } },
    },
    orderBy: { completedAt: "asc" },
  });
}

export async function createReview({
  bookingId,
  reviewerId,
  rating,
  content,
}: {
  bookingId: string;
  reviewerId: string;
  rating: number;
  content?: string;
}) {
  const eligibility = await getReviewEligibility(bookingId, reviewerId);
  if (!eligibility.eligible) {
    throw new ReviewError(
      eligibility.reason === "already_reviewed"
        ? "You've already reviewed this booking"
        : eligibility.reason === "not_completed"
          ? "You can only review a completed booking"
          : eligibility.reason === "window_expired"
            ? "The review window for this booking has closed"
            : "Booking not found",
      400,
    );
  }

  const booking = eligibility.booking;
  const review = await db.review.create({
    data: {
      bookingId,
      reviewerId,
      reviewedId: booking.providerId,
      rating,
      content,
    },
    include: { reviewer: { select: { firstName: true, name: true } } },
  });

  await notify({
    userId: booking.providerId,
    type: "NEW_REVIEW",
    title: "New review",
    message: `${partyName(review.reviewer)} left you a ${rating}-star review`,
    data: { bookingId },
    email: {
      subject: "New review — Fgrapher",
      html: newReviewEmailHtml({
        t: await getTranslations("libServices.email"),
        reviewerName: partyName(review.reviewer),
        rating,
        bookingUrl: bookingUrlFor(bookingId),
      }),
    },
  });

  return review;
}

export async function updateReview({
  reviewId,
  userId,
  rating,
  content,
}: {
  reviewId: string;
  userId: string;
  rating: number;
  content?: string;
}) {
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review || review.reviewerId !== userId) {
    throw new ReviewError("Review not found", 404);
  }

  const daysSincePosted =
    (Date.now() - review.createdAt.getTime()) / 86_400_000;
  if (daysSincePosted > EDIT_WINDOW_DAYS) {
    throw new ReviewError(
      "Reviews can only be edited within 7 days of posting",
      400,
    );
  }

  return db.review.update({
    where: { id: reviewId },
    data: { rating, content },
  });
}

export async function respondToReview({
  reviewId,
  providerId,
  response,
}: {
  reviewId: string;
  providerId: string;
  response: string;
}) {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: { reviewed: { select: { firstName: true, name: true } } },
  });
  if (!review || review.reviewedId !== providerId) {
    throw new ReviewError("Review not found", 404);
  }
  if (review.response) {
    throw new ReviewError(
      "This review already has a response — use edit instead",
      400,
    );
  }

  const updated = await db.review.update({
    where: { id: reviewId },
    data: { response, respondedAt: new Date() },
  });

  await notify({
    userId: review.reviewerId,
    type: "REVIEW_RESPONSE",
    title: "New response to your review",
    message: `${partyName(review.reviewed)} responded to your review`,
    data: { bookingId: review.bookingId },
    email: {
      subject: "New response to your review — Fgrapher",
      html: reviewResponseEmailHtml({
        t: await getTranslations("libServices.email"),
        providerName: partyName(review.reviewed),
        bookingUrl: bookingUrlFor(review.bookingId),
      }),
    },
  });

  return updated;
}

export async function updateReviewResponse({
  reviewId,
  providerId,
  response,
}: {
  reviewId: string;
  providerId: string;
  response: string;
}) {
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review || review.reviewedId !== providerId) {
    throw new ReviewError("Review not found", 404);
  }
  if (!review.respondedAt) {
    throw new ReviewError("No response to edit yet", 400);
  }
  const hoursSinceResponse =
    (Date.now() - review.respondedAt.getTime()) / 3_600_000;
  if (hoursSinceResponse > RESPONSE_EDIT_WINDOW_HOURS) {
    throw new ReviewError("Responses can only be edited within 24 hours", 400);
  }

  return db.review.update({ where: { id: reviewId }, data: { response } });
}

export async function getProviderReviewStats(providerId: string) {
  const [reviews, totalBookingsCompleted] = await Promise.all([
    db.review.findMany({ where: { reviewedId: providerId } }),
    db.booking.count({ where: { providerId, status: "COMPLETED" } }),
  ]);

  const total = reviews.length;
  const avgRating =
    total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  const responded = reviews.filter((r) => r.response).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  const awaitingResponse = total - responded;

  return {
    avgRating,
    total,
    responseRate,
    awaitingResponse,
    totalBookingsCompleted,
  };
}

export async function listProviderReviews({
  providerId,
  filter,
  minRating,
}: {
  providerId: string;
  filter?: "AWAITING" | "RESPONDED";
  minRating?: number;
}) {
  return db.review.findMany({
    where: {
      reviewedId: providerId,
      ...(filter === "AWAITING" ? { response: null } : {}),
      ...(filter === "RESPONDED" ? { response: { not: null } } : {}),
      ...(minRating ? { rating: minRating } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reviewer: { select: { name: true, firstName: true, avatar: true } },
      booking: { select: { service: { select: { name: true } } } },
    },
  });
}
