"use client";

import type { MediaType, ProfileCategory, Role } from "@prisma/client";
import { CalendarCog, CalendarDays, MessageCircle, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { AvailabilityDialog } from "@/components/profile/availability-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { PROVIDER_ROLES } from "@/lib/constants";
import type { ResponseBucket } from "@/lib/response-time";

import { CostumesTab, type PublicCostume } from "./costumes-tab";
import { GearTab } from "./gear-tab";
import { PortfolioTab } from "./portfolio-tab";
import { PostsTab, type ProfilePost } from "./posts-tab";
import {
  AboutProvider,
  PackageList,
  ProfileSection,
  ReviewsSummary,
  ThingsToKnow,
} from "./profile-sections";
import { ScheduleDialog } from "./schedule-dialog";
import { ServiceArea } from "./service-area";
import { StudioPlace, StudioSpace, type StudioHours } from "./studio-space";

interface OwnerAlbum {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  coverMedia: { id: string; url: string; type: MediaType } | null;
  mediaCount: number;
  isPublished: boolean;
}

export interface ProfileFacts {
  identityVerifiedAt: string | null;
  phoneVerified: boolean;
  joinedAt: string;
  response: ResponseBucket | null;
  depositPercent: number | null;
  depositPolicy: string | null;
  cancellationPolicy: string | null;
  reschedulePolicy: string | null;
}

interface ProfileInteractiveProps {
  /** The left card: cover, avatar, name, rating, actions. Built on the server. */
  header: React.ReactNode;
  username: string;
  providerId: string;
  profileId: string;
  role: Role;
  roleLabel: string;
  firstName: string;
  /** The name the profile trades under — a shop's name, not its owner's. */
  displayName: string;
  avatar: string | null;
  hasGear: boolean;
  viewerId: string | null;
  posts: ProfilePost[];
  costumes: PublicCostume[];
  albums: {
    id: string;
    title: string;
    description: string | null;
    category: ProfileCategory | null;
    coverMedia: { id: string; url: string; type: MediaType } | null;
    media: {
      id: string;
      url: string;
      type: MediaType;
      title: string | null;
      width: number | null;
      height: number | null;
    }[];
    socialPost: {
      id: string;
      likeCount: number;
      commentCount: number;
      likedByViewer: boolean;
    } | null;
    /** "Chụp tại" — the public photo spot the album was shot at. */
    place?: { name: string; href: string } | null;
  }[];
  // Only present (non-null) when isOwnProfile — everything the owner has,
  // unfiltered by isPublished/moderation (unlike `albums` above).
  ownerAlbums: OwnerAlbum[] | null;
  canEditPortfolio: boolean;
  billingEnabled: boolean;
  services: {
    id: string;
    name: string;
    description: string | null;
    duration: number;
    price: number;
    currency: string;
    editedPhotoCount?: number | null;
    deliveryDays?: number | null;
  }[];
  reviews: {
    id: string;
    rating: number;
    content: string | null;
    response: string | null;
    createdAt: string;
    reviewer: {
      name: string | null;
      firstName: string | null;
      avatar: string | null;
    };
  }[];
  reviewStats: {
    avgRating: number;
    count: number;
    breakdown: { stars: number; count: number; percent: number }[];
  };
  products: {
    id: string;
    name: string;
    type: "SALE" | "RENT" | "BOTH";
    price: number | null;
    rentalPrice: number | null;
    currency: string;
    images: { url: string }[];
  }[];
  offersTfp?: boolean;
  isOwnProfile: boolean;
  acceptingBookings: boolean;
  facts: ProfileFacts | null;
  yearsExperience: number | null;
  completedShoots: number;
  modelDetails: { label: string; value: string }[];
  area: {
    location: string | null;
    radiusKm: number | null;
    nationwide: boolean;
  };
  /** "Từ 2.000.000₫". */
  priceLabel: string | null;
  /** "Phản hồi trong 2 giờ · 312 buổi đã chụp". */
  trustLine: string | null;
  sunPoint: { latitude: number; longitude: number } | null;
  /** STUDIO only: the room's size, amenities and opening hours. */
  studio: {
    area: number | null;
    amenities: string[];
    hours: StudioHours[];
  } | null;
  minNoticeHours: number;
}

// The profile page, laid out as an Airbnb service listing (owner,
// 17/11/2026): on a wide screen the provider's card stays on the left with
// the price and "Xem lịch trống" under it, and the right column reads top to
// bottom - packages, work, reviews, about, area, things to know. On a phone
// the card comes first and the price bar stays at the bottom. Picking a time
// happens in the schedule dialog, Airbnb's "Schedule your photo shoot".
//
// The same page is what a provider's link (/p/<username>) opens, so it also
// carries what that page used to: the deposit and cancellation terms, and a
// "Nhắn tin" that opens the chat with a first question written.
export function ProfileInteractive({
  header,
  username,
  providerId,
  profileId,
  role,
  roleLabel,
  firstName,
  displayName,
  avatar,
  hasGear,
  viewerId,
  posts,
  costumes,
  albums,
  ownerAlbums,
  canEditPortfolio,
  billingEnabled,
  services,
  reviews,
  reviewStats,
  products,
  offersTfp,
  isOwnProfile,
  acceptingBookings,
  facts,
  yearsExperience,
  completedShoots,
  modelDetails,
  area,
  priceLabel,
  trustLine,
  sunPoint,
  studio,
  minNoticeHours,
}: ProfileInteractiveProps) {
  const t = useTranslations("profilePage");
  const tabsT = useTranslations("publicPages.profile.tabs");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [focusService, setFocusService] = useState<string | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  // A camera shop has no portfolio, services or bookings — its profile is a
  // product listing. A costume shop's profile IS its outfit catalogue: the
  // visitor picks an outfit and messages the shop (project owner,
  // 22/09/2026).
  const isProductShop = !PROVIDER_ROLES.includes(role);
  const isProvider = !isProductShop && costumes.length === 0;
  // A studio is booked as a business, so it is addressed by its name.
  const callName = role === "STUDIO" ? displayName : firstName;

  const photos = albums.flatMap((album) =>
    album.media.filter((m) => m.type === "IMAGE").map((m) => m.url),
  );

  // Chat needs an account. Built here with the whole URL so a visitor goes
  // straight to sign-in without a round trip through the proxy (whose own
  // redirect keeps the query string too, since 19/11/2026).
  const messageHref = (() => {
    const href = `/dashboard/messages?to=${providerId}&consult=1`;
    return viewerId ? href : `/login?callbackUrl=${encodeURIComponent(href)}`;
  })();

  const openSchedule = (serviceId: string | null = null) => {
    setFocusService(serviceId);
    setScheduleOpen(true);
  };

  const canBook = isProvider && acceptingBookings && !isOwnProfile;

  const priceCard = isOwnProfile ? (
    <div className="flex flex-col gap-3 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-5 shadow-[var(--shadow-md)]">
      <p className="text-body-sm text-text-secondary">{t("own.body")}</p>
      <div className="flex flex-wrap gap-2">
        {isProvider ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAvailabilityOpen(true)}
          >
            <CalendarCog className="size-4" />
            {t("own.hours")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/share" />}
        >
          <QrCode className="size-4" />
          {t("own.share")}
        </Button>
      </div>
      <AvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
      />
    </div>
  ) : (
    <div className="flex items-center justify-between gap-4 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-5 shadow-[var(--shadow-md)]">
      <div className="flex min-w-0 flex-col">
        <span className="text-heading-md font-semibold! tabular-nums text-text-primary">
          {isProvider ? (priceLabel ?? t("price.ask")) : displayName}
        </span>
        <span className="truncate text-meta text-text-secondary">
          {isProvider
            ? acceptingBookings
              ? (trustLine ?? t("price.noCharge"))
              : t("price.paused")
            : t("price.shop")}
        </span>
      </div>
      {canBook ? (
        <Button variant="accent" size="lg" onClick={() => openSchedule()}>
          {t("price.showDates")}
        </Button>
      ) : (
        <Button
          variant="accent"
          size="lg"
          nativeButton={false}
          render={<Link href={messageHref} />}
        >
          {t("price.message")}
        </Button>
      )}
    </div>
  );

  return (
    <>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] xl:gap-20">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
          {header}
          <div className="max-lg:hidden">{priceCard}</div>
          {isOwnProfile ? <div className="lg:hidden">{priceCard}</div> : null}
        </aside>

        <div className="min-w-0">
          {isProvider && studio ? (
            <ProfileSection id="space" title={t("sections.space")}>
              <StudioSpace
                photos={photos}
                area={studio.area}
                amenities={studio.amenities}
              />
            </ProfileSection>
          ) : null}

          {isProvider ? (
            <>
              <ProfileSection id="services" title={t("sections.services")}>
                {services.length > 0 ? (
                  <>
                    {offersTfp ? (
                      <Badge variant="accent" className="mb-4 w-fit">
                        {t("packages.tfpBadge")}
                      </Badge>
                    ) : null}
                    <PackageList
                      services={services}
                      photos={photos}
                      onPick={(id) => (canBook ? openSchedule(id) : undefined)}
                      readOnly={!canBook}
                    />
                    {isOwnProfile ? null : (
                      <p className="mt-5 text-body-sm text-text-secondary">
                        {t.rich("packages.customize", {
                          name: callName,
                          link: (chunks) => (
                            <Link
                              href={messageHref}
                              className="font-semibold! text-text-primary underline underline-offset-4"
                            >
                              {chunks}
                            </Link>
                          ),
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-[var(--fg-radius-xl)] border border-dashed border-border-strong p-6">
                    <p className="text-body-md text-text-primary">
                      {t("packages.emptyTitle", { name: callName })}
                    </p>
                    {isOwnProfile ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={messageHref} />}
                      >
                        {t("packages.askPrice")}
                      </Button>
                    )}
                  </div>
                )}
              </ProfileSection>

              <ProfileSection
                id="portfolio"
                // "Ảnh đã chụp" is a photographer's heading: a studio shows
                // its rooms and a videographer shows films (25/11/2026).
                title={
                  role === "STUDIO"
                    ? t("sections.portfolioStudio")
                    : role === "VIDEOGRAPHER"
                      ? t("sections.portfolioFilm")
                      : t("sections.portfolio")
                }
              >
                <PortfolioTab
                  username={username}
                  albums={albums}
                  ownerAlbums={ownerAlbums}
                  profileId={profileId}
                  role={role}
                  viewerId={viewerId}
                  isOwnProfile={isOwnProfile}
                  canEdit={canEditPortfolio}
                  billingEnabled={billingEnabled}
                />
              </ProfileSection>

              <ProfileSection
                id="reviews"
                title={
                  reviewStats.count > 0
                    ? t("reviews.heading", {
                        rating: reviewStats.avgRating
                          .toFixed(2)
                          .replace(".", ","),
                        count: reviewStats.count,
                      })
                    : t("sections.reviews")
                }
              >
                <ReviewsSummary
                  providerId={providerId}
                  providerName={displayName}
                  callName={callName}
                  joinedAt={facts?.joinedAt ?? new Date().toISOString()}
                  reviews={reviews}
                  stats={reviewStats}
                />
              </ProfileSection>

              <ProfileSection
                id="about"
                title={t("sections.about", { name: callName })}
              >
                <AboutProvider
                  displayName={displayName}
                  roleLabel={roleLabel}
                  role={role}
                  avatar={avatar}
                  facts={{
                    yearsExperience,
                    completedShoots,
                    response: facts?.response ?? null,
                    identityVerifiedAt: facts?.identityVerifiedAt ?? null,
                    phoneVerified: facts?.phoneVerified ?? false,
                    joinedAt: facts?.joinedAt ?? new Date().toISOString(),
                    offersTfp: Boolean(offersTfp),
                  }}
                  modelDetails={modelDetails}
                />
              </ProfileSection>

              {studio ? (
                // A studio does not travel: "Khu vực làm việc" with a
                // travel radius said nothing a customer needs. Where it is
                // and when it is open does.
                <ProfileSection id="area" title={t("sections.areaStudio")}>
                  <StudioPlace location={area.location} hours={studio.hours} />
                </ProfileSection>
              ) : (
                <ProfileSection id="area" title={t("sections.area")}>
                  <ServiceArea
                    location={area.location}
                    radiusKm={area.radiusKm}
                    nationwide={area.nationwide}
                  />
                </ProfileSection>
              )}

              {facts ? (
                <ProfileSection id="know" title={t("sections.know")}>
                  <ThingsToKnow
                    callName={callName}
                    policies={{
                      depositPercent: facts.depositPercent,
                      depositPolicy: facts.depositPolicy,
                      cancellationPolicy: facts.cancellationPolicy,
                      reschedulePolicy: facts.reschedulePolicy,
                    }}
                    minNoticeHours={minNoticeHours}
                  />
                </ProfileSection>
              ) : null}
            </>
          ) : null}

          {costumes.length > 0 ? (
            <ProfileSection id="costumes">
              <CostumesTab
                costumes={costumes}
                shopUserId={providerId}
                isOwnProfile={isOwnProfile}
              />
            </ProfileSection>
          ) : null}
          {hasGear ? (
            <ProfileSection
              id="gear"
              title={tabsT(isProductShop ? "products" : "gear")}
            >
              <GearTab products={products} />
            </ProfileSection>
          ) : null}
          {posts.length > 0 ? (
            <ProfileSection id="posts" title={tabsT("posts")}>
              <PostsTab posts={posts} isOwnProfile={isOwnProfile} />
            </ProfileSection>
          ) : null}

          {isOwnProfile ? null : (
            <div className="border-t border-border-subtle pt-8">
              <Button
                variant="secondary"
                size="lg"
                // Wraps: it carries the provider's whole name, and a trade
                // name ran past an iPhone SE's edge on one line (25/11/2026).
                className="h-auto min-h-12 w-full py-3 text-center whitespace-normal"
                nativeButton={false}
                render={<Link href={messageHref} />}
              >
                <MessageCircle className="size-4 shrink-0" />
                {t("messageCta", { name: callName })}
              </Button>
            </div>
          )}
        </div>
      </div>

      {isOwnProfile ? null : (
        <StickyActionBar
          label={t("sticky.label")}
          title={isProvider ? (priceLabel ?? t("price.ask")) : displayName}
          subtitle={trustLine}
          // The icon button is the way to message a provider whose main
          // button books a date. Where messaging IS the main button (a
          // costume shop, a provider not taking bookings) it was the same
          // link twice, side by side.
          secondary={
            canBook ? (
              <Button
                variant="outline"
                size="icon"
                aria-label={t("price.message")}
                nativeButton={false}
                render={<Link href={messageHref} />}
              >
                <MessageCircle className="size-4" />
              </Button>
            ) : undefined
          }
          primary={
            canBook ? (
              <Button
                variant="accent"
                className="min-w-32"
                onClick={() => openSchedule()}
              >
                <CalendarDays className="size-4" />
                {t("sticky.pick")}
              </Button>
            ) : (
              <Button
                variant="accent"
                className="min-w-32"
                nativeButton={false}
                render={<Link href={messageHref} />}
              >
                {t("price.message")}
              </Button>
            )
          }
        />
      )}

      {canBook ? (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          providerId={providerId}
          callName={callName}
          services={services}
          focusServiceId={focusService}
          photos={photos}
          sunPoint={sunPoint}
        />
      ) : null}
    </>
  );
}
