"use client";

import type { MediaType, ProfileCategory, Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BookingSidebar } from "@/components/profile/booking-sidebar";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

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
  hasGear: boolean;
  albums: {
    id: string;
    title: string;
    description: string | null;
    category: ProfileCategory | null;
    coverMedia: { id: string; url: string; type: MediaType } | null;
    media: { id: string; url: string; type: MediaType; title: string | null }[];
  }[];
  // Only present (non-null) when isOwnProfile — everything the owner has,
  // unfiltered by isPublished/moderation (unlike `albums` above). See
  // page.tsx's comment on why this is a second, separate fetch.
  ownerAlbums: OwnerAlbum[] | null;
  canEditPortfolio: boolean;
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
  hasGear,
  albums,
  ownerAlbums,
  canEditPortfolio,
  services,
  reviews,
  reviewStats,
  products,
  offersTfp,
  isOwnProfile,
}: ProfileInteractiveProps) {
  const t = useTranslations("publicPages.profile.tabs");
  const router = useRouter();
  const [tab, setTab] = useState("portfolio");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );

  // Jump straight to the booking page with this service pre-selected
  // (booking-wizard.tsx reads ?service= on mount) — scrolling to the
  // sidebar and asking the visitor to click "Đặt lịch ngay" a second
  // time was an extra, confusing step for what's already a clear intent.
  const onBook = (serviceId: string) => {
    router.push(`/booking/${providerId}?service=${serviceId}`);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
          <TabsList>
            <TabsTab value="portfolio">{t("portfolio")}</TabsTab>
            <TabsTab value="services">{t("services")}</TabsTab>
            <TabsTab value="reviews">{t("reviews")}</TabsTab>
            {hasGear ? <TabsTab value="gear">Gear</TabsTab> : null}
          </TabsList>
          <TabsPanel value="portfolio" className="mt-6">
            <PortfolioTab
              albums={albums}
              ownerAlbums={ownerAlbums}
              profileId={profileId}
              role={role}
              isOwnProfile={isOwnProfile}
              canEdit={canEditPortfolio}
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
          {hasGear ? (
            <TabsPanel value="gear" className="mt-6">
              <GearTab products={products} />
            </TabsPanel>
          ) : null}
        </Tabs>
      </div>

      <div id="booking-sidebar">
        <BookingSidebar
          providerId={providerId}
          firstName={firstName}
          services={services}
          selectedServiceId={selectedServiceId}
          onServiceChange={setSelectedServiceId}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  );
}
