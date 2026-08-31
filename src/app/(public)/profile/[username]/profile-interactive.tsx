"use client";

import type { MediaType, ProfileCategory } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { BookingSidebar } from "@/components/profile/booking-sidebar";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

import { GearTab } from "./gear-tab";
import { PortfolioTab } from "./portfolio-tab";
import { ReviewsTab } from "./reviews-tab";
import { ServicesTab } from "./services-tab";

interface ProfileInteractiveProps {
  providerId: string;
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
}

export function ProfileInteractive({
  providerId,
  firstName,
  hasGear,
  albums,
  services,
  reviews,
  reviewStats,
  products,
  offersTfp,
}: ProfileInteractiveProps) {
  const t = useTranslations("publicPages.profile.tabs");
  const [tab, setTab] = useState("portfolio");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );

  const onBook = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    document
      .getElementById("booking-sidebar")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <PortfolioTab albums={albums} />
          </TabsPanel>
          <TabsPanel value="services" className="mt-6">
            <ServicesTab
              services={services}
              onBook={onBook}
              offersTfp={offersTfp}
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
        />
      </div>
    </div>
  );
}
