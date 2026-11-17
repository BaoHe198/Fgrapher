import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import {
  LinkLanding,
  type LinkLandingProps,
} from "@/components/link-page/link-landing";
import { ProfileViewBeacon } from "@/components/profile/profile-view-beacon";
import { auth } from "@/lib/auth";
import { MIN_NOTICE_HOURS, PROVIDER_ROLES } from "@/lib/constants";
import { formatAdministrativeLocation, shortPlace } from "@/lib/location";
import { responseBucket } from "@/lib/response-time";
import { formatCurrency } from "@/lib/utils";
import { getProfileStats } from "@/services/profile-stats";
import {
  getProfileReviews,
  getProfileReviewStats,
  getPublicProfileUser,
} from "@/services/public-profile";

// The page a provider's link and QR code open (/p/<username>): what someone
// arriving from TikTok, Facebook, Instagram or a Zalo chat needs, in the
// order they decide - who this is, what other customers say, the prices,
// what is asked of them and what they get, the free days, then message or
// book. The full profile (/profile/<username>) stays the place to browse the
// whole portfolio; this one is built to turn a tap into a request.
//
// It sits in the (focus) group on purpose: no site header or footer to
// wander off into, the same reasoning as the booking flow.

interface LinkPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ role?: string }>;
}

// Shared by generateMetadata and the page, as on /profile/[username] (see
// the comment there on why the two must not fetch separately).
const loadProfile = cache(async (username: string) => {
  const user = await getPublicProfileUser(username);
  if (!user || user.profiles.length === 0) return null;
  return user;
});

type LoadedUser = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

/** The profile this link is about: one that takes bookings. */
function bookableProfile(user: LoadedUser, roleParam?: string) {
  const bookable = user.profiles.filter((p) => PROVIDER_ROLES.includes(p.role));
  return bookable.find((p) => p.role === roleParam) ?? bookable[0] ?? null;
}

function startingPrice(profile: LoadedUser["profiles"][number]) {
  const paid = profile.services.map((s) => s.price).filter((p) => p > 0);
  if (paid.length > 0) return Math.min(...paid);
  return profile.priceMin ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: LinkPageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) return {};
  const { role: roleParam } = await searchParams;
  const profile = bookableProfile(user, roleParam);
  if (!profile) return {};

  const [t, roleT, stats] = await Promise.all([
    getTranslations("linkPage.metadata"),
    getTranslations("role"),
    getProfileReviewStats(user.id),
  ]);
  const name = profile.displayName ?? user.name ?? username;
  const place = formatAdministrativeLocation(
    profile,
    profile.wardId || profile.provinceId ? undefined : { ward: user.ward },
  );
  const price = startingPrice(profile);
  const isVerified =
    user.roles.find((r) => r.role === profile.role)?.verificationStatus ===
    "VERIFIED";

  // What a Zalo or Messenger link preview shows under the photo: the facts
  // that decide whether someone taps - price, rating, verified, where.
  const facts = [
    price ? t("from", { price: formatCurrency(price) }) : null,
    stats.count > 0
      ? t("rating", {
          rating: stats.avgRating.toFixed(1).replace(".", ","),
          count: stats.count,
        })
      : null,
    isVerified ? t("verified") : null,
    place ? shortPlace(place) : null,
  ].filter(Boolean);
  const title = t("title", { name, role: roleT(profile.role) });
  const description = [facts.join(" · "), t("cta")].filter(Boolean).join(". ");
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const ogImage =
    user.coverImage ??
    profile.albums[0]?.coverMedia?.url ??
    profile.media[0]?.url;

  return {
    title,
    description,
    // One profile, two doors: search engines should index the full profile,
    // not this copy of it.
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/p/${username}`,
      type: "profile",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function LinkPage({
  params,
  searchParams,
}: LinkPageProps) {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) notFound();

  const { role: roleParam } = await searchParams;
  const profile = bookableProfile(user, roleParam);
  // A costume or camera shop takes no bookings; its link still has to land
  // somewhere useful, and that is its catalogue.
  if (!profile) redirect(`/profile/${username}`);

  const [session, roleT, reviews, reviewStats, stats] = await Promise.all([
    auth(),
    getTranslations("role"),
    getProfileReviews(user.id),
    getProfileReviewStats(user.id),
    getProfileStats(user.id),
  ]);
  const isOwnProfile = session?.user?.id === user.id;

  const displayName = profile.displayName ?? user.name ?? username;
  const roleRecord = user.roles.find((r) => r.role === profile.role);
  const isVerified = roleRecord?.verificationStatus === "VERIFIED";
  const place = formatAdministrativeLocation(
    profile,
    profile.wardId || profile.provinceId ? undefined : { ward: user.ward },
  );

  const photos = profile.albums
    .flatMap((album) =>
      album.media
        .filter((media) => media.type === "IMAGE")
        .map((media) => ({
          id: media.id,
          url: media.url,
          albumTitle: album.title,
        })),
    )
    .slice(0, 8);

  const data: LinkLandingProps = {
    providerId: user.id,
    username,
    roleParam: user.profiles.length > 1 ? profile.role : null,
    roleLabel: roleT(profile.role),
    // A studio is booked as a business, so it is addressed by its name.
    callName:
      profile.role === "STUDIO"
        ? displayName
        : (user.firstName ?? displayName.split(" ")[0] ?? displayName),
    displayName,
    avatar: user.avatar,
    coverImage:
      user.coverImage ?? photos[0]?.url ?? profile.media[0]?.url ?? null,
    place: place ? shortPlace(place) : null,
    description: profile.description,
    isVerified,
    verifiedAt:
      isVerified && roleRecord?.verifiedAt
        ? roleRecord.verifiedAt.toISOString()
        : null,
    phoneVerified: user.phoneVerified,
    joinedAt: user.createdAt.toISOString(),
    acceptingBookings: user.acceptingBookings,
    isOwnProfile,
    signedIn: Boolean(session?.user),
    rating: {
      average: reviewStats.avgRating,
      count: reviewStats.count,
      breakdown: reviewStats.breakdown,
    },
    reviews: reviews.slice(0, 3).map((review) => ({
      id: review.id,
      rating: review.rating,
      content: review.content,
      response: review.response,
      createdAt: review.createdAt.toISOString(),
      reviewerName: review.reviewer.firstName ?? review.reviewer.name ?? null,
      reviewerAvatar: review.reviewer.avatar,
    })),
    completedShoots: stats.completedShoots,
    yearsExperience: profile.yearsExperience ?? null,
    response:
      stats.responseMinutes !== null
        ? responseBucket(stats.responseMinutes)
        : null,
    services: profile.services
      .slice()
      .sort((a, b) => a.price - b.price)
      .map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        currency: service.currency,
        duration: service.duration,
        editedPhotoCount: service.editedPhotoCount,
        deliveryDays: service.deliveryDays,
      })),
    priceFrom: startingPrice(profile),
    policies: {
      depositPercent: profile.depositPercent,
      depositPolicy: profile.depositPolicy,
      cancellationPolicy: profile.cancellationPolicy,
      reschedulePolicy: profile.reschedulePolicy,
    },
    area: {
      location: place || null,
      radiusKm: profile.serviceRadiusKm,
      nationwide: profile.servesNationwide,
    },
    photos,
    // About 10 km of precision: enough for sunrise maths, too coarse to
    // locate anyone (same rounding as the full profile).
    sunPoint:
      profile.latitude != null && profile.longitude != null
        ? {
            latitude: Math.round(profile.latitude * 10) / 10,
            longitude: Math.round(profile.longitude * 10) / 10,
          }
        : null,
    minNoticeHours: MIN_NOTICE_HOURS,
  };

  return (
    <>
      {isOwnProfile ? null : <ProfileViewBeacon profileId={profile.id} />}
      <LinkLanding {...data} />
    </>
  );
}
