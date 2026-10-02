"use client";

import type { MediaType, ProfileCategory, Role } from "@prisma/client";
import { CalendarDays, Loader2, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { BookingSidebar } from "@/components/profile/booking-sidebar";
import { useMessaging } from "@/components/providers/messaging-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionNav } from "@/components/ui/section-nav";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { PROVIDER_ROLES } from "@/lib/constants";

import { CostumesTab, type PublicCostume } from "./costumes-tab";
import { PostsTab, type ProfilePost } from "./posts-tab";
import { GearTab } from "./gear-tab";
import { PortfolioTab } from "./portfolio-tab";
import { ProfileFacts, type ProfileFactsProps } from "./profile-facts";
import { ReviewsTab } from "./reviews-tab";
import { ServiceArea } from "./service-area";
import { ServicesTab } from "./services-tab";
import { StudioSpace } from "./studio-space";

interface OwnerAlbum {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  coverMedia: { id: string; url: string; type: MediaType } | null;
  mediaCount: number;
  isPublished: boolean;
}

interface ProfileInteractiveProps {
  username: string;
  providerId: string;
  profileId: string;
  role: Role;
  firstName: string;
  /** The name the profile trades under — a shop's name, not its owner's. */
  displayName: string;
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
  }[];
  // Only present (non-null) when isOwnProfile — everything the owner has,
  // unfiltered by isPublished/moderation (unlike `albums` above). See
  // page.tsx's comment on why this is a second, separate fetch.
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
  facts: ProfileFactsProps | null;
  area: {
    location: string | null;
    radiusKm: number | null;
    nationwide: boolean;
  };
  /** "Từ 2.000.000₫" for the phone action bar. */
  priceLabel: string | null;
  /** "Phản hồi trong 2 giờ · 312 buổi đã chụp". */
  trustLine: string | null;
  sunPoint: { latitude: number; longitude: number } | null;
  /** STUDIO only: the room's size and amenities. */
  studio: { area: number | null; amenities: string[] } | null;
}

export function ProfileInteractive({
  username,
  providerId,
  profileId,
  role,
  firstName,
  displayName,
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
  facts,
  area,
  priceLabel,
  trustLine,
  sunPoint,
  studio,
}: ProfileInteractiveProps) {
  const t = useTranslations("publicPages.profile.tabs");
  const sectionT = useTranslations("publicPages.profile.sections");
  const stickyT = useTranslations("publicPages.profile.bookingSidebar");
  const router = useRouter();
  const messaging = useMessaging();
  // A camera shop has no portfolio, services or bookings — its profile is a
  // product listing. A costume shop is a provider (it takes bookings and has
  // a portfolio) that also keeps an outfit catalogue, so it must NOT take the
  // product-shop layout even though SHOP_ROLES contains it.
  const isProductShop = !PROVIDER_ROLES.includes(role);
  // A costume shop's profile IS its catalogue: no portfolio, no services, no
  // calendar — the visitor picks an outfit and messages the shop (project
  // owner, 22/09/2026).
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarInView, setSidebarInView] = useState(false);
  // The hero's own "Đặt lịch" (#hero-book). The sticky bar appears only
  // once it has scrolled out above the screen (Core MVP pass, 02/10/2026).
  const [heroCtaAbove, setHeroCtaAbove] = useState(false);
  useEffect(() => {
    const el = document.getElementById("hero-book");
    if (!el || typeof IntersectionObserver === "undefined") {
      startTransition(() => setHeroCtaAbove(true));
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setHeroCtaAbove(
        !entry.isIntersecting && entry.boundingClientRect.top < 0,
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The sticky bar exists only to reach actions that are off-screen. Once the
  // BookingSidebar itself is on screen it carries the same two actions, so
  // showing both meant four buttons doing two things — and the sticky "Đặt
  // lịch" was actively useless there, since all it does is scroll to the
  // sidebar the visitor is already looking at. Hide it while the sidebar is
  // visible. rootMargin trims the sticky bar's own height off the bottom of
  // the viewport so the handover happens before the two can overlap.
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setSidebarInView(entry?.isIntersecting ?? false),
      { rootMargin: "0px 0px -96px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Jump straight to the booking page with this service pre-selected
  // (booking-wizard.tsx reads ?service= on mount) — scrolling to the
  // sidebar and asking the visitor to click "Đặt lịch ngay" a second
  // time was an extra, confusing step for what's already a clear intent.
  const onBook = (serviceId: string) => {
    router.push(`/booking/${providerId}?service=${serviceId}`);
  };

  // QA: on mobile the layout is a single column, so the real booking
  // sidebar (with its own Đặt lịch/Nhắn tin) sits after the entire
  // portfolio/services/reviews tab content — reachable only after a long
  // scroll. This sticky bar keeps both actions reachable from anywhere,
  // same targets as BookingSidebar's own buttons (direct booking-page
  // navigation, same conversation-opening call), just always in reach.
  const onStickyMessage = async () => {
    setIsOpeningChat(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: providerId }),
      });
      // Signed out, this used to do nothing at all — the most common
      // first tap on a profile was a dead button (24/09 audit).
      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      const body = await res.json();
      if (res.ok && body.data?.id) {
        messaging.open(body.data.id);
      }
    } finally {
      setIsOpeningChat(false);
    }
  };

  // One scrolling page with a sticky section bar (redesign 09/2026) rather
  // than tabs: a customer reads a profile top to bottom - work, packages,
  // reviews, where they work - and tabs hid three of those four.
  const isProvider = !isProductShop && costumes.length === 0;
  const sections = [
    ...(isProvider && studio
      ? [{ id: "space", label: sectionT("space") }]
      : []),
    ...(isProvider
      ? [
          { id: "portfolio", label: t("portfolio") },
          { id: "services", label: t("services") },
          { id: "reviews", label: t("reviews") },
          { id: "area", label: sectionT("area") },
        ]
      : []),
    ...(costumes.length > 0 ? [{ id: "costumes", label: t("costumes") }] : []),
    ...(hasGear
      ? [{ id: "gear", label: t(isProductShop ? "products" : "gear") }]
      : []),
    ...(posts.length > 0 ? [{ id: "posts", label: t("posts") }] : []),
  ];
  const sectionClass = "scroll-mt-36 pt-10 first:pt-6";

  return (
    <div
      className={
        isOwnProfile
          ? "grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px]"
          : "grid grid-cols-1 items-start gap-10 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0"
      }
    >
      <div className="min-w-0">
        {sections.length > 1 ? (
          <SectionNav
            items={sections}
            offset={72}
            topClassName="top-[72px]"
            label={sectionT("navLabel")}
            className="-mx-5 md:mx-0"
          />
        ) : null}

        {isProvider && studio ? (
          <section id="space" className={sectionClass}>
            <h2 className="mb-5 text-display-md text-text-primary">
              {sectionT("space")}
            </h2>
            <StudioSpace
              photos={albums.flatMap((album) =>
                album.media
                  .filter((media) => media.type === "IMAGE")
                  .map((media) => media.url),
              )}
              area={studio.area}
              amenities={studio.amenities}
            />
          </section>
        ) : null}
        {isProvider ? (
          <>
            <section id="portfolio" className={sectionClass}>
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
            </section>
            <section id="services" className={sectionClass}>
              <h2 className="mb-5 text-display-md text-text-primary">
                {t("services")}
              </h2>
              <ServicesTab
                services={services}
                onBook={onBook}
                onMessage={onStickyMessage}
                offersTfp={offersTfp}
                isOwnProfile={isOwnProfile}
              />
            </section>
            <section id="reviews" className={sectionClass}>
              <h2 className="mb-5 text-display-md text-text-primary">
                {sectionT("reviews")}
              </h2>
              <div className="flex flex-col gap-8">
                <ReviewsTab
                  providerId={providerId}
                  providerName={displayName}
                  reviews={reviews}
                  stats={reviewStats}
                />
                {facts ? <ProfileFacts {...facts} /> : null}
              </div>
            </section>
            <section id="area" className={sectionClass}>
              <h2 className="mb-5 text-display-md text-text-primary">
                {sectionT("area")}
              </h2>
              <ServiceArea
                location={area.location}
                radiusKm={area.radiusKm}
                nationwide={area.nationwide}
              />
            </section>
          </>
        ) : null}
        {costumes.length > 0 ? (
          <section id="costumes" className={sectionClass}>
            <CostumesTab
              costumes={costumes}
              shopUserId={providerId}
              isOwnProfile={isOwnProfile}
            />
          </section>
        ) : null}
        {hasGear ? (
          <section id="gear" className={sectionClass}>
            <GearTab products={products} />
          </section>
        ) : null}
        {posts.length > 0 ? (
          <section id="posts" className={sectionClass}>
            <PostsTab posts={posts} isOwnProfile={isOwnProfile} />
          </section>
        ) : null}
      </div>

      <div
        id="booking-sidebar"
        ref={sidebarRef}
        className="scroll-mt-24 lg:sticky lg:top-[96px]"
      >
        {isProductShop || costumes.length > 0 ? (
          <Card className="flex flex-col gap-3">
            <h3 className="text-heading-lg text-text-primary">{displayName}</h3>
            <p className="text-body-sm text-text-secondary">
              {stickyT("shopMessageHelp")}
            </p>
            {isOwnProfile ? null : (
              <Button
                variant="accent"
                className="w-full"
                disabled={isOpeningChat}
                onClick={onStickyMessage}
              >
                {isOpeningChat ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {stickyT("stickyMessage")}
              </Button>
            )}
          </Card>
        ) : (
          <BookingSidebar
            providerId={providerId}
            // A studio is booked as a business, so the card says "Đặt lịch
            // với Đức Thịnh Creative Studio", matching its profile and the
            // booking wizard, not the owner's first name.
            firstName={role === "STUDIO" ? displayName : firstName}
            services={services}
            selectedServiceId={selectedServiceId}
            onServiceChange={setSelectedServiceId}
            isOwnProfile={isOwnProfile}
            priceLabel={priceLabel}
            rating={reviewStats.count > 0 ? reviewStats.avgRating : null}
            reviewCount={reviewStats.count}
            onMessage={onStickyMessage}
            isOpeningChat={isOpeningChat}
            sunPoint={sunPoint}
          />
        )}
      </div>

      {isOwnProfile ? null : (
        <StickyActionBar
          label={stickyT("quickBook")}
          visible={heroCtaAbove && !sidebarInView}
          title={
            isProductShop || costumes.length > 0 ? displayName : priceLabel
          }
          subtitle={trustLine}
          secondary={
            services.length === 0 ? undefined : (
              <Button
                variant="outline"
                size="icon"
                aria-label={stickyT("stickyMessage")}
                disabled={isOpeningChat}
                onClick={onStickyMessage}
              >
                {isOpeningChat ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
              </Button>
            )
          }
          primary={
            // No packages to pick a date for: ask for a price instead.
            isProductShop || costumes.length > 0 || services.length === 0 ? (
              <Button
                variant="accent"
                className="min-w-32"
                disabled={isOpeningChat}
                onClick={onStickyMessage}
              >
                {services.length === 0 &&
                !isProductShop &&
                costumes.length === 0
                  ? stickyT("askPrice")
                  : stickyT("stickyMessage")}
              </Button>
            ) : (
              <Button
                variant="accent"
                className="min-w-32"
                onClick={() =>
                  document
                    .getElementById("booking-sidebar")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <CalendarDays className="size-4" />
                {stickyT("chooseDate")}
              </Button>
            )
          }
        />
      )}
    </div>
  );
}
