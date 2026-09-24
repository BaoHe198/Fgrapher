"use client";

import type { MediaType, ProfileCategory, Role } from "@prisma/client";
import { CalendarDays, Loader2, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BookingSidebar } from "@/components/profile/booking-sidebar";
import { useMessaging } from "@/components/providers/messaging-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { PROVIDER_ROLES } from "@/lib/constants";

import { CostumesTab, type PublicCostume } from "./costumes-tab";
import { PostsTab, type ProfilePost } from "./posts-tab";
import { GearTab } from "./gear-tab";
import { PortfolioTab } from "./portfolio-tab";
import { ReviewsTab } from "./reviews-tab";
import { ServicesTab } from "./services-tab";

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
}

export function ProfileInteractive({
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
}: ProfileInteractiveProps) {
  const t = useTranslations("publicPages.profile.tabs");
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
  const [tab, setTab] = useState(
    costumes.length > 0 ? "costumes" : isProductShop ? "gear" : "portfolio",
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarInView, setSidebarInView] = useState(false);

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

  return (
    <div
      className={
        isOwnProfile
          ? "grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px]"
          : "grid grid-cols-1 items-start gap-10 pb-20 lg:pb-0 lg:grid-cols-[1fr_360px]"
      }
    >
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
          <TabsList>
            {isProductShop ? null : (
              <>
                <TabsTab value="portfolio">{t("portfolio")}</TabsTab>
                <TabsTab value="services">{t("services")}</TabsTab>
                <TabsTab value="reviews">{t("reviews")}</TabsTab>
              </>
            )}
            {hasGear ? (
              <TabsTab value="gear">
                {t(isProductShop ? "products" : "gear")}
              </TabsTab>
            ) : null}
            {costumes.length > 0 ? (
              <TabsTab value="costumes">{t("costumes")}</TabsTab>
            ) : null}
            {posts.length > 0 ? (
              <TabsTab value="posts">{t("posts")}</TabsTab>
            ) : null}
          </TabsList>
          {isProductShop ? null : (
            <>
              <TabsPanel value="portfolio" className="mt-6">
                <PortfolioTab
                  albums={albums}
                  ownerAlbums={ownerAlbums}
                  profileId={profileId}
                  role={role}
                  viewerId={viewerId}
                  isOwnProfile={isOwnProfile}
                  canEdit={canEditPortfolio}
                  billingEnabled={billingEnabled}
                />
              </TabsPanel>
              <TabsPanel value="services" className="mt-6">
                <ServicesTab
                  services={services}
                  onBook={onBook}
                  offersTfp={offersTfp}
                  isOwnProfile={isOwnProfile}
                />
              </TabsPanel>
              <TabsPanel value="reviews" className="mt-6">
                <ReviewsTab
                  providerId={providerId}
                  reviews={reviews}
                  stats={reviewStats}
                />
              </TabsPanel>
            </>
          )}
          {hasGear ? (
            <TabsPanel value="gear" className="mt-6">
              <GearTab products={products} />
            </TabsPanel>
          ) : null}
          {costumes.length > 0 ? (
            <TabsPanel value="costumes" className="mt-6">
              <CostumesTab
                costumes={costumes}
                shopUserId={providerId}
                isOwnProfile={isOwnProfile}
              />
            </TabsPanel>
          ) : null}
          {posts.length > 0 ? (
            <TabsPanel value="posts" className="mt-6">
              <PostsTab posts={posts} />
            </TabsPanel>
          ) : null}
        </Tabs>
      </div>

      <div id="booking-sidebar" ref={sidebarRef}>
        {isProductShop ? (
          <Card className="sticky top-[104px] flex flex-col gap-3">
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
          />
        )}
      </div>

      {isOwnProfile || sidebarInView ? null : (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border-subtle bg-bg-surface p-3 shadow-[var(--shadow-lg)] lg:hidden">
          <Button
            variant="secondary"
            className="flex-1"
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
          {isProductShop ? null : (
            <Button
              variant="accent"
              className="flex-1"
              onClick={() =>
                document
                  .getElementById("booking-sidebar")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <CalendarDays className="size-4" />
              {stickyT("stickyBook")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
