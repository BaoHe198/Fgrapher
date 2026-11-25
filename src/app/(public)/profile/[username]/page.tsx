import type { Metadata } from "next";
import { BadgeCheck, ChevronLeft, MapPin, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge } from "@/components/ui/badge";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileViewBeacon } from "@/components/profile/profile-view-beacon";
import { auth } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { getAgeRangeLabel } from "@/lib/account/age-gate";
import { formatAdministrativeLocation, shortPlace } from "@/lib/location";
import {
  MIN_NOTICE_HOURS,
  PROVIDER_ROLES,
  type ROLE_LABELS,
} from "@/lib/constants";
import { features } from "@/lib/features";
import { responseBucket } from "@/lib/response-time";
import { cn, formatCurrency, jsonLdScriptProps } from "@/lib/utils";
import { listAlbums } from "@/services/albums";
import {
  getProfileReviews,
  getProfileReviewStats,
  getPublicProfileUser,
  getShopProducts,
} from "@/services/public-profile";
import { splitVietnameseName } from "@/lib/vietnam/name";
import { listPublicCostumes } from "@/services/costumes";
import { getProfileStats } from "@/services/profile-stats";
import { listWeeklyRules } from "@/services/resource-calendar";
import { listAlbumSocialState, listUserPosts } from "@/services/posts";

import { ProfileAvatar, ProfileCover } from "./profile-hero";
import { ProfileInteractive } from "./profile-interactive";

function joinRoleLabels(
  roles: { role: keyof typeof ROLE_LABELS }[],
  roleT: (role: string) => string,
) {
  const labels = roles.map((p) => roleT(p.role));
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ role?: string }>;
}

// Shared with generateMetadata below via React's cache() — without it, the
// metadata pass and the page each ran this independently, which (empirically,
// not just in theory) left descendant Client Components unhydrated: their
// DOM rendered correctly and even passed elementFromPoint hit-testing, but no
// onClick ever fired, with zero console/hydration warnings. Deduping the
// fetch is Next.js's own documented fix for generateMetadata + page sharing
// data, and it resolved the issue here too.
const loadProfile = cache(async (username: string) => {
  const user = await getPublicProfileUser(username);
  if (!user || user.profiles.length === 0) return null;
  return user;
});

export async function generateMetadata({
  params,
  searchParams,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) return {};

  const { role: roleParam } = await searchParams;
  const activeProfile =
    user.profiles.find((p) => p.role === roleParam) ?? user.profiles[0];
  const name = activeProfile.displayName ?? user.name ?? username;
  const [roleT, t, factT, stats] = await Promise.all([
    getTranslations("role"),
    getTranslations("publicPages.profile.metadata"),
    getTranslations("linkPage.metadata"),
    getProfileReviewStats(user.id),
  ]);

  // Prompt F7, VIỆC 3 — always an absolute URL (never window.location,
  // which would bake in "localhost" for anyone testing/sharing from a dev
  // build — Facebook/Zalo can't fetch that to read the tags below).
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/profile/${username}`;
  const title = t("title", {
    name,
    role: joinRoleLabels(user.profiles, roleT),
  });
  // What a Zalo or Messenger link preview shows under the photo: the facts
  // that decide whether someone taps - price, rating, verified, where -
  // then the provider's own words. Shared links open this page (the /p/
  // link redirects here), so this is the preview of a provider's link too.
  const paidPrices = activeProfile.services
    .map((s) => s.price)
    .filter((p) => p > 0);
  const fromPrice =
    paidPrices.length > 0
      ? Math.min(...paidPrices)
      : (activeProfile.priceMin ?? null);
  const place = formatAdministrativeLocation(
    activeProfile,
    activeProfile.wardId || activeProfile.provinceId
      ? undefined
      : { ward: user.ward },
  );
  const verified =
    user.roles.find((r) => r.role === activeProfile.role)
      ?.verificationStatus === "VERIFIED";
  const facts = [
    fromPrice ? factT("from", { price: formatCurrency(fromPrice) }) : null,
    stats.count > 0
      ? factT("rating", {
          rating: stats.avgRating.toFixed(1).replace(".", ","),
          count: stats.count,
        })
      : null,
    verified ? factT("verified") : null,
    place ? shortPlace(place) : null,
  ].filter(Boolean);
  const description = [
    facts.join(" · "),
    activeProfile.description || t("fallbackDescription", { name }),
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 200);
  // Cover photo first, then the first approved portfolio image — no
  // generated branded fallback (would need next/og wired up, deferred).
  // A profile with neither still gets title/description in the share
  // preview, just no image.
  const ogImage = user.coverImage ?? activeProfile.media[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      title,
      description,
      url,
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

export default async function PublicProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) {
    notFound();
  }

  const [roleT, experienceLevelT, t] = await Promise.all([
    getTranslations("role"),
    getTranslations("experienceLevel"),
    getTranslations("publicPages.profile"),
  ]);

  const { role: roleParam } = await searchParams;
  const activeProfile =
    user.profiles.find((p) => p.role === roleParam) ?? user.profiles[0];
  const session = await auth();
  const isOwnProfile = session?.user?.id === user.id;

  const [
    reviews,
    reviewStats,
    products,
    ownerAlbums,
    posts,
    costumes,
    albumSocialState,
    stats,
  ] = await Promise.all([
    getProfileReviews(user.id),
    getProfileReviewStats(user.id),
    features.marketplaceEnabled
      ? getShopProducts(user.id, activeProfile.role)
      : Promise.resolve([]),
    // getPublicProfileUser's activeProfile.albums (below) is filtered to
    // isPublished albums with at least one APPROVED photo — correct for
    // what a visitor sees, but the owner needs to see and reorder
    // everything they have, including drafts and albums still pending
    // moderation. Same call dashboard/portfolio/page.tsx makes for its
    // own owner-only view.
    isOwnProfile && PROVIDER_ROLES.includes(activeProfile.role)
      ? listAlbums(activeProfile.id)
      : Promise.resolve(null),
    features.socialFeedEnabled
      ? listUserPosts(user.id, session?.user?.id ?? null)
      : Promise.resolve([]),
    // A costume shop's outfit catalogue. Not behind MARKETPLACE_ENABLED:
    // outfits live here, not on Chợ F (project owner, 21/09/2026,
    // reconfirmed 22/09/2026).
    activeProfile.role === "COSTUME_SHOP"
      ? listPublicCostumes(activeProfile.id)
      : Promise.resolve([]),
    features.socialFeedEnabled
      ? listAlbumSocialState(
          activeProfile.albums.map((album) => album.id),
          session?.user?.id ?? null,
        )
      : Promise.resolve([]),
    getProfileStats(user.id),
  ]);
  const albumSocialById = new Map(
    albumSocialState.map((state) => [state.albumId, state]),
  );

  // Album creation (POST /api/albums) requires an active subscription
  // server-side; dashboard/portfolio/page.tsx already hides its whole
  // AlbumGrid behind the same check via SubscriptionGate (a Server
  // Component, can't be used inside ProfileInteractive/PortfolioTab which
  // are Client Components) — this mirrors that by computing the boolean
  // here and passing it down instead. In practice a lapsed subscription
  // also unpublishes every Profile row (expireLocalSubscriptions), which
  // already 404s this whole page for everyone including the owner — this
  // only matters for the narrow window between actual expiry and the
  // next daily cron run.
  const canEditPortfolio =
    isOwnProfile && PROVIDER_ROLES.includes(activeProfile.role)
      ? await requireActiveSubscription(user.id, activeProfile.role)
          .then(() => true)
          .catch(() => false)
      : false;

  // A studio's opening hours are its weekly calendar, the same rows the
  // booking page reads, so the two cannot say different things.
  const studioHours =
    activeProfile.role === "STUDIO" ? await listWeeklyRules(user.id) : [];

  const displayName = activeProfile.displayName ?? user.name ?? username;
  const profileLocation = formatAdministrativeLocation(
    activeProfile,
    activeProfile.wardId || activeProfile.provinceId
      ? undefined
      : { ward: user.ward },
  );
  // From the public name, not the account's stored first name: that was
  // split at sign-up, and a trade name registered as "Lan Anh Studio" was
  // stored as first name "Anh Studio" (23/11/2026 walk-through).
  const firstName = splitVietnameseName(displayName).firstName;
  const isVerified =
    user.roles.find((r) => r.role === activeProfile.role)
      ?.verificationStatus === "VERIFIED";
  // Never expose the exact date of birth beyond this computed range — see
  // lib/account/age-gate.ts's comment on why a range, not an age, is public.
  const ageRangeLabel =
    activeProfile.role === "MODEL" && user.dateOfBirth
      ? getAgeRangeLabel(user.dateOfBirth)
      : null;
  const modelDetails =
    activeProfile.role === "MODEL"
      ? ([
          activeProfile.height
            ? {
                label: t("modelDetails.height"),
                value: `${activeProfile.height} cm`,
              }
            : null,
          activeProfile.experienceLevel
            ? {
                label: t("modelDetails.experience"),
                value: experienceLevelT(activeProfile.experienceLevel),
              }
            : null,
          activeProfile.travelWilling
            ? {
                label: t("modelDetails.travel"),
                value: t("modelDetails.willingToTravel"),
              }
            : null,
          activeProfile.agencyRepresented
            ? {
                label: t("modelDetails.agency"),
                value:
                  activeProfile.agencyName || t("modelDetails.represented"),
              }
            : null,
          activeProfile.measurements
            ? {
                label: t("modelDetails.measurements"),
                value: activeProfile.measurements,
              }
            : null,
          activeProfile.hairColor
            ? { label: t("modelDetails.hair"), value: activeProfile.hairColor }
            : null,
          activeProfile.eyeColor
            ? { label: t("modelDetails.eyes"), value: activeProfile.eyeColor }
            : null,
          activeProfile.shoeSize
            ? {
                label: t("modelDetails.shoeSize"),
                value: activeProfile.shoeSize,
              }
            : null,
        ].filter(Boolean) as { label: string; value: string }[])
      : [];
  const offersTfp = activeProfile.services.some((s) => s.price === 0);
  // From the true DB-side aggregate (reviewStats), not reviews.length —
  // getProfileReviews only fetches a capped page for display, which
  // would otherwise silently under-count/misaverage a heavily-reviewed
  // provider.
  const averageRating = reviewStats.avgRating.toFixed(1);

  // Redesign 09/2026 header stats and trust facts. Each appears only when
  // there is something true to say: no "0 buổi đã chụp", no guessed
  // response time.
  const isProviderRole = PROVIDER_ROLES.includes(activeProfile.role);
  const roleRecord = user.roles.find((r) => r.role === activeProfile.role);
  const response =
    stats.responseMinutes !== null
      ? responseBucket(stats.responseMinutes)
      : null;
  const minServicePrice = activeProfile.services.length
    ? Math.min(
        ...activeProfile.services.map((s) => s.price).filter((p) => p > 0),
      )
    : null;
  const startingPrice =
    minServicePrice !== null && Number.isFinite(minServicePrice)
      ? minServicePrice
      : (activeProfile.priceMin ?? null);
  const priceLabel = startingPrice
    ? t("priceFrom", { price: formatCurrency(startingPrice) })
    : null;
  const trustLine =
    [
      response
        ? t(`responseShort.${response.unit}`, { count: response.value })
        : null,
      stats.completedShoots > 0
        ? t("shootsShort", { count: stats.completedShoots })
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;
  // Golden-hour hints need where the shoot roughly is, not the address:
  // one decimal place is about 10 km, plenty for sunrise maths and too
  // coarse to locate anyone.
  const sunPoint =
    activeProfile.latitude != null && activeProfile.longitude != null
      ? {
          latitude: Math.round(activeProfile.latitude * 10) / 10,
          longitude: Math.round(activeProfile.longitude * 10) / 10,
        }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activeProfile.role === "STUDIO" ? "LocalBusiness" : "Person",
    name: displayName,
    image: user.avatar ?? undefined,
    description: activeProfile.description ?? undefined,
    address: profileLocation
      ? { "@type": "PostalAddress", addressLocality: profileLocation }
      : undefined,
    ...(reviewStats.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating,
            reviewCount: reviewStats.count,
          },
        }
      : {}),
  };

  // The left card of the Airbnb-style page (owner, 17/11/2026): the cover,
  // the avatar over its lower edge, the name, what they do and where, the
  // rating, and the share/save actions. On a phone the cover runs edge to
  // edge and the rest slides up over it as a sheet.
  const ratingText =
    reviewStats.count > 0
      ? t("hero.rating", {
          rating: averageRating.replace(".", ","),
          count: reviewStats.count,
        })
      : t("status.new");
  const header = (
    <div className="flex flex-col items-center text-center">
      <div className="relative isolate aspect-[16/10] w-full overflow-hidden bg-bg-sunken max-lg:-mx-5 max-lg:aspect-[4/3] max-lg:w-[calc(100%+2.5rem)] sm:max-lg:-mx-8 sm:max-lg:w-[calc(100%+4rem)] lg:rounded-[var(--fg-radius-xl)]">
        <ProfileCover
          variant="hero"
          name={displayName}
          coverImage={user.coverImage}
          fallbackImage={activeProfile.media[0]?.url ?? null}
          isOwnProfile={isOwnProfile}
        />
        <Link
          href="/browse"
          aria-label={t("hero.backToResults")}
          className="focus-ring absolute top-3 left-3 z-10 inline-flex size-10 items-center justify-center rounded-full bg-bg-surface/90 text-text-primary shadow-[var(--shadow-sm)] backdrop-blur"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center gap-3 px-2 max-lg:-mx-5 max-lg:-mt-6 max-lg:w-[calc(100%+2.5rem)] max-lg:rounded-t-[28px] max-lg:bg-bg-page max-lg:px-5 max-lg:pt-1 sm:max-lg:-mx-8 sm:max-lg:w-[calc(100%+4rem)] sm:max-lg:px-8">
        <ProfileAvatar
          avatar={user.avatar}
          displayName={displayName}
          isOwnProfile={isOwnProfile}
        />
        {user.profiles.length > 1 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {user.profiles.map((profile) => (
              <Link
                key={profile.id}
                href={`/profile/${username}?role=${profile.role}`}
                aria-current={
                  profile.role === activeProfile.role ? "page" : undefined
                }
                className={cn(
                  "focus-ring inline-flex min-h-9 items-center rounded-full border px-3 text-body-sm",
                  profile.role === activeProfile.role
                    ? "border-text-primary font-semibold! text-text-primary"
                    : "border-border-default text-text-secondary hover:text-text-primary",
                )}
              >
                {roleT(profile.role)}
              </Link>
            ))}
          </div>
        ) : null}
        <h1
          id="profile-name"
          className="animate-rise text-display-lg text-balance break-words text-text-primary"
        >
          {displayName}
        </h1>
        {activeProfile.description ? (
          <p className="line-clamp-4 max-w-[46ch] text-body-md whitespace-pre-line text-text-secondary">
            {activeProfile.description}
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-0.5 text-body-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold! text-text-primary">
            {reviewStats.count > 0 ? (
              <Star aria-hidden className="size-3.5 fill-current" />
            ) : null}
            {ratingText}
          </span>
          <span className="text-text-secondary">
            {profileLocation
              ? t("roleIn", {
                  role: roleT(activeProfile.role),
                  place: shortPlace(profileLocation),
                })
              : roleT(activeProfile.role)}
          </span>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-meta text-text-secondary">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 font-semibold! text-gold-600 dark:text-success">
              <BadgeCheck aria-hidden className="size-3.5" />
              {t("status.verified")}
            </span>
          ) : null}
          {activeProfile.servesNationwide ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {t("nationwide")}
            </span>
          ) : null}
          {ageRangeLabel ? (
            <span>{t("age", { age: ageRangeLabel })}</span>
          ) : null}
          {isProviderRole && !user.acceptingBookings ? (
            <Badge variant="warning">{t("status.bookedOut")}</Badge>
          ) : null}
        </p>
        <ProfileActions
          targetUserId={user.id}
          profileId={activeProfile.id}
          // The link page (/p/...) opens this same profile; sharing it
          // gives the short, tidy link.
          shareUrl={`${process.env.NEXTAUTH_URL ?? ""}/p/${username}`}
          socialFeedEnabled={features.socialFeedEnabled}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <script {...jsonLdScriptProps(jsonLd)} />
      {/* Counting a view needs a cookie to remember this visitor was already
          counted, and a Server Component cannot set one — so the count is
          reported by this beacon after mount instead of inline here. */}
      {isOwnProfile ? null : <ProfileViewBeacon profileId={activeProfile.id} />}
      <div className="mx-auto w-full max-w-[1280px] px-5 pt-0 pb-[calc(112px+env(safe-area-inset-bottom))] sm:px-8 lg:pt-8 lg:pb-24">
        <ProfileInteractive
          header={header}
          username={username}
          providerId={user.id}
          profileId={activeProfile.id}
          role={activeProfile.role}
          roleLabel={roleT(activeProfile.role)}
          firstName={firstName}
          displayName={displayName}
          avatar={user.avatar}
          // Chợ F carries equipment from every gear owner, not only camera
          // shops, so the section follows the listings themselves. A camera
          // shop keeps it even with nothing listed, because it IS its profile.
          hasGear={
            features.marketplaceEnabled &&
            (activeProfile.role === "CAMERA_SHOP" || products.length > 0)
          }
          posts={posts}
          costumes={costumes}
          viewerId={session?.user?.id ?? null}
          albums={activeProfile.albums.map((album) => ({
            ...album,
            socialPost: albumSocialById.get(album.id) ?? null,
          }))}
          ownerAlbums={
            ownerAlbums?.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              category: a.category,
              coverMedia: a.coverMedia,
              mediaCount: a._count.media,
              isPublished: a.isPublished,
            })) ?? null
          }
          services={activeProfile.services}
          reviews={reviews.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))}
          reviewStats={reviewStats}
          products={products}
          offersTfp={offersTfp}
          isOwnProfile={isOwnProfile}
          acceptingBookings={user.acceptingBookings}
          canEditPortfolio={canEditPortfolio}
          billingEnabled={features.billingEnabled}
          facts={
            isProviderRole
              ? {
                  identityVerifiedAt:
                    isVerified && roleRecord?.verifiedAt
                      ? roleRecord.verifiedAt.toISOString()
                      : null,
                  phoneVerified: user.phoneVerified,
                  joinedAt: user.createdAt.toISOString(),
                  response,
                  depositPercent: activeProfile.depositPercent,
                  depositPolicy: activeProfile.depositPolicy,
                  cancellationPolicy: activeProfile.cancellationPolicy,
                  reschedulePolicy: activeProfile.reschedulePolicy,
                }
              : null
          }
          yearsExperience={activeProfile.yearsExperience ?? null}
          completedShoots={stats.completedShoots}
          modelDetails={modelDetails}
          area={{
            location: profileLocation || null,
            radiusKm: activeProfile.serviceRadiusKm,
            nationwide: activeProfile.servesNationwide,
          }}
          priceLabel={priceLabel}
          trustLine={trustLine}
          sunPoint={sunPoint}
          studio={
            activeProfile.role === "STUDIO"
              ? {
                  area: activeProfile.area,
                  amenities: activeProfile.amenities,
                  hours: studioHours.map((rule) => ({
                    dayOfWeek: rule.dayOfWeek,
                    startTime: rule.startTime,
                    endTime: rule.endTime,
                  })),
                }
              : null
          }
          minNoticeHours={MIN_NOTICE_HOURS}
        />
      </div>
    </div>
  );
}
