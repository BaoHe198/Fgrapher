import type { Metadata } from "next";
import { BadgeCheck, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilmLeader } from "@/components/ui/film-leader";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileViewBeacon } from "@/components/profile/profile-view-beacon";
import { auth } from "@/lib/auth";
import { requireActiveSubscription } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getAgeRangeLabel } from "@/lib/account/age-gate";
import { formatAdministrativeLocation } from "@/lib/location";
import { PROVIDER_ROLES, type ROLE_LABELS } from "@/lib/constants";
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
import { listPublicCostumes } from "@/services/costumes";
import { getProfileStats } from "@/services/profile-stats";
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
  const [roleT, t] = await Promise.all([
    getTranslations("role"),
    getTranslations("publicPages.profile.metadata"),
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
  const description = (
    activeProfile.description || t("fallbackDescription", { name })
  ).slice(0, 160);
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
    followerCount,
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
    features.socialFeedEnabled
      ? db.follow.count({ where: { followingId: user.id } })
      : Promise.resolve(0),
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

  const displayName = activeProfile.displayName ?? user.name ?? username;
  const profileLocation = formatAdministrativeLocation(
    activeProfile,
    activeProfile.wardId || activeProfile.provinceId
      ? undefined
      : { ward: user.ward },
  );
  const firstName = user.firstName ?? displayName.split(" ")[0];
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
  const headerStats = [
    stats.completedShoots > 0
      ? { value: String(stats.completedShoots), label: t("stats.shoots") }
      : null,
    reviewStats.count > 0
      ? {
          value: averageRating.replace(".", ","),
          label: t("stats.rating", { count: reviewStats.count }),
        }
      : null,
    activeProfile.yearsExperience
      ? {
          value: String(activeProfile.yearsExperience),
          label: t("stats.years"),
        }
      : null,
  ].filter(Boolean) as { value: string; label: string }[];
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

  return (
    <div className="flex flex-col">
      <script {...jsonLdScriptProps(jsonLd)} />
      {/* Counting a view needs a cookie to remember this visitor was already
          counted, and a Server Component cannot set one — so the count is
          reported by this beacon after mount instead of inline here. */}
      {isOwnProfile ? null : <ProfileViewBeacon profileId={activeProfile.id} />}
      {/* Wave 2: the profile opens on Phòng tối - the cover full-bleed at
          about three quarters of the screen, the name set large over a
          scrim, then a film leader cuts back to Paper for everything one
          reads and fills in. */}
      <section
        data-surface="darkroom"
        data-under-header=""
        aria-labelledby="profile-name"
        className="relative isolate flex min-h-[76vh] flex-col justify-end overflow-hidden bg-dr-bg text-dr-text max-md:min-h-[68vh]"
      >
        <ProfileCover
          variant="hero"
          name={displayName}
          coverImage={user.coverImage}
          fallbackImage={activeProfile.media[0]?.url ?? null}
          isOwnProfile={isOwnProfile}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-dr-bg via-[var(--dr-scrim)] via-50% to-transparent to-90%"
        />
        <span className="absolute top-4 left-5 rounded-full bg-[var(--dr-scrim)] px-3 py-1.5 font-mono text-meta tracking-[0.12em] text-dr-text-2 uppercase sm:left-8">
          {t("hero.frame")}
        </span>
        <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 pt-32 pb-8 sm:px-8 sm:pb-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-dr-text-2">
            <ProfileAvatar
              compact
              avatar={user.avatar}
              displayName={displayName}
              isOwnProfile={isOwnProfile}
            />
            {user.profiles.length > 1 ? (
              user.profiles.map((profile) => (
                <Link
                  key={profile.id}
                  href={`/profile/${username}?role=${profile.role}`}
                  aria-current={
                    profile.role === activeProfile.role ? "page" : undefined
                  }
                  className={cn(
                    "focus-ring rounded-full border px-2.5 py-1",
                    profile.role === activeProfile.role
                      ? "border-gold-400 text-dr-text"
                      : "border-dr-line-2 hover:text-dr-text",
                  )}
                >
                  {roleT(profile.role)}
                </Link>
              ))
            ) : (
              <span>{roleT(activeProfile.role)}</span>
            )}
            {profileLocation ? (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden className="size-3.5" />
                {profileLocation}
              </span>
            ) : null}
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-gold-400">
                <BadgeCheck aria-hidden className="size-3.5" />
                {t("status.verified")}
              </span>
            ) : null}
            {activeProfile.servesNationwide ? (
              <span>{t("nationwide")}</span>
            ) : null}
            {ageRangeLabel ? (
              <span>{t("age", { age: ageRangeLabel })}</span>
            ) : null}
            {isProviderRole && !user.acceptingBookings ? (
              <Badge variant="warning">{t("status.bookedOut")}</Badge>
            ) : null}
          </div>
          <h1
            id="profile-name"
            className="max-w-6xl font-display text-[clamp(2.75rem,8vw,7rem)] leading-[0.92] font-semibold tracking-[-0.035em] text-balance break-words text-dr-text"
          >
            {displayName}
          </h1>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            {headerStats.length > 0 ? (
              <dl className="flex flex-wrap gap-x-8 gap-y-2">
                {headerStats.map((stat) => (
                  <div key={stat.label} className="flex flex-col">
                    <dt className="order-last text-meta text-dr-text-2">
                      {stat.label}
                    </dt>
                    <dd className="font-mono text-heading-lg font-semibold! tabular-nums text-dr-text">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : reviewStats.count === 0 ? (
              <span className="text-body-sm text-dr-text-2">
                {t("status.new")}
              </span>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              {isProviderRole && user.acceptingBookings && !isOwnProfile ? (
                <Button
                  variant="accent"
                  size="lg"
                  nativeButton={false}
                  render={<Link href={`/booking/${user.id}`} />}
                >
                  {t("hero.book")}
                </Button>
              ) : null}
              <ProfileActions
                targetUserId={user.id}
                profileId={activeProfile.id}
                initialFollowerCount={followerCount}
                shareUrl={`${process.env.NEXTAUTH_URL ?? ""}/profile/${username}`}
                socialFeedEnabled={features.socialFeedEnabled}
                isOwnProfile={isOwnProfile}
              />
            </div>
          </div>
        </div>
      </section>
      <FilmLeader label="00A" trailing={t("hero.leader")} />

      <div className="mx-auto w-full max-w-[1440px] px-5 pb-[72px] sm:px-8">
        <div className="flex flex-col gap-[18px] pt-8">
          {activeProfile.description ? (
            <p className="my-5 max-w-[640px] text-body-lg text-text-secondary">
              {activeProfile.description}
            </p>
          ) : null}

          {modelDetails.length > 0 ? (
            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 rounded-[var(--fg-radius-lg)] bg-surface-card p-5 sm:grid-cols-4">
              {modelDetails.map((detail) => (
                <div key={detail.label} className="flex flex-col gap-0.5">
                  <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
                    {detail.label}
                  </span>
                  <span className="text-body-md font-semibold! text-text-primary">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <ProfileInteractive
            username={username}
            providerId={user.id}
            profileId={activeProfile.id}
            role={activeProfile.role}
            firstName={firstName}
            displayName={displayName}
            // Chợ F carries equipment from every gear owner, not only
            // camera shops, so the tab follows the listings themselves. A
            // camera shop keeps the tab even with nothing listed, because
            // that tab IS its profile.
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
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
