import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { StarRating } from "@/components/ui/star-rating";
import { Tag } from "@/components/ui/tag";
import { ProfileActions } from "@/components/profile/profile-actions";
import { db } from "@/lib/db";
import { getAgeRangeLabel } from "@/lib/age-gate";
import type { ROLE_LABELS } from "@/lib/constants";
import { features } from "@/lib/features";
import {
  getProfileReviews,
  getPublicProfileUser,
  getShopProducts,
  incrementProfileView,
} from "@/services/public-profile";

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
  const bio = activeProfile.description ?? "";
  const roleT = await getTranslations("role");

  return {
    title: `${name} — ${joinRoleLabels(user.profiles, roleT)} in ${user.location ?? "Fgrapher"} | Fgrapher`,
    description: bio.slice(0, 155),
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      images: user.coverImage ? [user.coverImage] : [],
      type: "profile",
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

  const [roleT, experienceLevelT] = await Promise.all([
    getTranslations("role"),
    getTranslations("experienceLevel"),
  ]);

  const { role: roleParam } = await searchParams;
  const activeProfile =
    user.profiles.find((p) => p.role === roleParam) ?? user.profiles[0];
  incrementProfileView(activeProfile.id);

  const [reviews, products, followerCount] = await Promise.all([
    getProfileReviews(user.id),
    features.marketplaceEnabled
      ? getShopProducts(user.id)
      : Promise.resolve([]),
    features.socialFeedEnabled
      ? db.follow.count({ where: { followingId: user.id } })
      : Promise.resolve(0),
  ]);

  const displayName = activeProfile.displayName ?? user.name ?? username;
  const firstName = user.firstName ?? displayName.split(" ")[0];
  const isVerified =
    user.roles.find((r) => r.role === activeProfile.role)
      ?.verificationStatus === "VERIFIED";
  // Never expose the exact date of birth beyond this computed range — see
  // lib/age-gate.ts's comment on why a range, not an age, is public.
  const ageRangeLabel =
    activeProfile.role === "MODEL" && user.dateOfBirth
      ? getAgeRangeLabel(user.dateOfBirth)
      : null;
  const modelDetails =
    activeProfile.role === "MODEL"
      ? ([
          activeProfile.height
            ? { label: "Height", value: `${activeProfile.height} cm` }
            : null,
          activeProfile.experienceLevel
            ? {
                label: "Experience",
                value: experienceLevelT(activeProfile.experienceLevel),
              }
            : null,
          activeProfile.travelWilling
            ? { label: "Travel", value: "Willing to travel" }
            : null,
          activeProfile.agencyRepresented
            ? {
                label: "Agency",
                value: activeProfile.agencyName || "Represented",
              }
            : null,
          activeProfile.measurements
            ? { label: "Measurements", value: activeProfile.measurements }
            : null,
          activeProfile.hairColor
            ? { label: "Hair", value: activeProfile.hairColor }
            : null,
          activeProfile.eyeColor
            ? { label: "Eyes", value: activeProfile.eyeColor }
            : null,
          activeProfile.shoeSize
            ? { label: "Shoe size", value: activeProfile.shoeSize }
            : null,
        ].filter(Boolean) as { label: string; value: string }[])
      : [];
  const offersTfp = activeProfile.services.some((s) => s.price === 0);
  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : "0.0";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activeProfile.role === "STUDIO" ? "LocalBusiness" : "Person",
    name: displayName,
    image: user.avatar ?? undefined,
    description: activeProfile.description ?? undefined,
    address: user.location
      ? { "@type": "PostalAddress", addressLocality: user.location }
      : undefined,
    ...(reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating,
            reviewCount: reviews.length,
          },
        }
      : {}),
  };

  return (
    <div className="flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative h-[280px] w-full">
        {user.coverImage ? (
          <Image
            src={user.coverImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <MediaPlaceholder tint="green-300" height="100%" />
        )}
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-4 pb-[72px] sm:px-8">
        <div className="mt-[-46px] flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-end justify-between gap-[18px]">
            <div className="flex items-end gap-[18px]">
              <Avatar className="size-[104px] border-4 border-bg-surface">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={displayName} />
                ) : null}
                <AvatarFallback className="text-heading-lg">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1.5 pb-2">
                <h1 className="text-display-md text-text-primary">
                  {displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {user.profiles.length > 1 ? (
                    user.profiles.map((profile) => (
                      <Tag
                        key={profile.id}
                        selected={profile.role === activeProfile.role}
                        render={
                          <Link
                            href={`/profile/${username}?role=${profile.role}`}
                          />
                        }
                      >
                        {roleT(profile.role)}
                      </Tag>
                    ))
                  ) : (
                    <Badge variant="accent">{roleT(activeProfile.role)}</Badge>
                  )}
                  <Badge
                    variant={user.acceptingBookings ? "success" : "warning"}
                  >
                    {user.acceptingBookings ? "Available" : "Booked out"}
                  </Badge>
                  {isVerified ? <Badge variant="accent">Verified</Badge> : null}
                  <StarRating rating={averageRating} reviews={reviews.length} />
                </div>
                {user.location || ageRangeLabel ? (
                  <div className="flex items-center gap-1.5 text-body-sm text-text-secondary">
                    {user.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {user.location}
                      </span>
                    ) : null}
                    {ageRangeLabel ? <span>· Age {ageRangeLabel}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>

            <ProfileActions
              targetUserId={user.id}
              profileId={activeProfile.id}
              initialFollowerCount={followerCount}
              shareUrl={`${process.env.NEXTAUTH_URL ?? ""}/profile/${username}`}
              socialFeedEnabled={features.socialFeedEnabled}
            />
          </div>

          {activeProfile.description ? (
            <p className="my-5 max-w-[640px] text-body-lg text-text-secondary">
              {activeProfile.description}
            </p>
          ) : null}

          {modelDetails.length > 0 ? (
            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 rounded-[var(--fg-radius-lg)] bg-surface-card p-5 sm:grid-cols-4">
              {modelDetails.map((detail) => (
                <div key={detail.label} className="flex flex-col gap-0.5">
                  <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
                    {detail.label}
                  </span>
                  <span className="text-body-md font-semibold text-text-primary">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <ProfileInteractive
            providerId={user.id}
            firstName={firstName}
            hasGear={
              features.marketplaceEnabled &&
              user.profiles.some((p) => p.role === "CAMERA_SHOP")
            }
            media={activeProfile.media}
            services={activeProfile.services}
            reviews={reviews.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
            }))}
            products={products}
            offersTfp={offersTfp}
          />
        </div>
      </div>
    </div>
  );
}
