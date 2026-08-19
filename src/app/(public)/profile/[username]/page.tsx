import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { StarRating } from "@/components/ui/star-rating";
import { ProfileActions } from "@/components/profile/profile-actions";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { getProfileReviews, getPublicProfileUser, getShopProducts, incrementProfileView } from "@/services/public-profile";

import { ProfileInteractive } from "./profile-interactive";

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

export async function generateMetadata({ params, searchParams }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) return {};

  const { role: roleParam } = await searchParams;
  const activeProfile = user.profiles.find((p) => p.role === roleParam) ?? user.profiles[0];
  const name = activeProfile.displayName ?? user.name ?? username;
  const bio = activeProfile.description ?? "";

  return {
    title: `${name} — ${ROLE_LABELS[activeProfile.role]} in ${user.location ?? "Fgrapher"} | Fgrapher`,
    description: bio.slice(0, 155),
    alternates: { canonical: `/profile/${username}` },
    openGraph: {
      images: user.coverImage ? [user.coverImage] : [],
      type: "profile",
    },
  };
}

export default async function PublicProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const user = await loadProfile(username);
  if (!user) {
    notFound();
  }

  const { role: roleParam } = await searchParams;
  const activeProfile = user.profiles.find((p) => p.role === roleParam) ?? user.profiles[0];
  incrementProfileView(activeProfile.id);

  const [reviews, products, followerCount] = await Promise.all([
    getProfileReviews(user.id),
    getShopProducts(user.id),
    db.follow.count({ where: { followingId: user.id } }),
  ]);

  const displayName = activeProfile.displayName ?? user.name ?? username;
  const firstName = user.firstName ?? displayName.split(" ")[0];
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": activeProfile.role === "STUDIO" ? "LocalBusiness" : "Person",
    name: displayName,
    image: user.avatar ?? undefined,
    description: activeProfile.description ?? undefined,
    address: user.location ? { "@type": "PostalAddress", addressLocality: user.location } : undefined,
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.coverImage} alt="" className="size-full object-cover" />
        ) : (
          <MediaPlaceholder tint="green-300" height="100%" />
        )}
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-4 pb-[72px] sm:px-8">
        <div className="mt-[-46px] flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-end justify-between gap-[18px]">
            <div className="flex items-end gap-[18px]">
              <Avatar className="size-[104px] border-4 border-bg-surface">
                {user.avatar ? <AvatarImage src={user.avatar} alt={displayName} /> : null}
                <AvatarFallback className="text-heading-lg">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1.5 pb-2">
                <h1 className="text-display-md text-text-primary">{displayName}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  {user.profiles.map((profile, index) => (
                    <Badge
                      key={profile.id}
                      variant={index === 0 ? "accent" : "neutral"}
                    >
                      {ROLE_LABELS[profile.role]}
                    </Badge>
                  ))}
                  <Badge variant={user.acceptingBookings ? "success" : "warning"}>
                    {user.acceptingBookings ? "Available" : "Booked out"}
                  </Badge>
                  <StarRating rating={averageRating} reviews={reviews.length} />
                </div>
              </div>
            </div>

            <ProfileActions
              targetUserId={user.id}
              profileId={activeProfile.id}
              initialFollowerCount={followerCount}
              shareUrl={`${process.env.NEXTAUTH_URL ?? ""}/profile/${username}`}
            />
          </div>

          {activeProfile.description ? (
            <p className="my-5 max-w-[640px] text-body-lg text-text-secondary">
              {activeProfile.description}
            </p>
          ) : null}

          <ProfileInteractive
            providerId={user.id}
            firstName={firstName}
            hasGear={user.profiles.some((p) => p.role === "CAMERA_SHOP")}
            media={activeProfile.media}
            services={activeProfile.services}
            reviews={reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
            products={products}
          />
        </div>
      </div>
    </div>
  );
}
