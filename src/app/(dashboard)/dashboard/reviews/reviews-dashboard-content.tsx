"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RespondReviewModal } from "@/components/modals/respond-review-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";

interface ReviewRow {
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
  serviceName: string | null;
}

interface Stats {
  avgRating: number;
  total: number;
  responseRate: number;
  awaitingResponse: number;
}

type FilterTab = "ALL" | "AWAITING" | "RESPONDED";

const TAB_VALUES: FilterTab[] = ["ALL", "AWAITING", "RESPONDED"];

function partyName(
  party: { firstName: string | null; name: string | null },
  t: ReturnType<typeof useTranslations>,
) {
  return party.firstName ?? party.name ?? t("anonymous");
}

export function ReviewsDashboardContent({
  stats,
  reviews,
}: {
  stats: Stats;
  reviews: ReviewRow[];
}) {
  const t = useTranslations("dashboardCore.reviews");
  const TABS: { value: FilterTab; label: string }[] = TAB_VALUES.map(
    (value) => ({ value, label: t(`tabs.${value}`) }),
  );
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [respondTarget, setRespondTarget] = useState<ReviewRow | null>(null);

  const filtered = useMemo(() => {
    if (tab === "AWAITING") return reviews.filter((r) => !r.response);
    if (tab === "RESPONDED") return reviews.filter((r) => r.response);
    return reviews;
  }, [reviews, tab]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">
            {t("stats.avgRating")}
          </span>
          <span className="text-heading-lg text-text-primary">
            {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">
            {t("stats.total")}
          </span>
          <span className="text-heading-lg text-text-primary">
            {stats.total}
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">
            {t("stats.responseRate")}
          </span>
          <span className="text-heading-lg text-text-primary">
            {stats.responseRate}%
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">
            {t("stats.awaitingResponse")}
          </span>
          <span className="text-heading-lg text-text-primary">
            {stats.awaitingResponse}
          </span>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsPanel key={t.value} value={t.value} />
        ))}
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Star className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((review) => (
            <Card key={review.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  {review.reviewer.avatar ? (
                    <AvatarImage src={review.reviewer.avatar} alt="" />
                  ) : null}
                  <AvatarFallback>
                    {partyName(review.reviewer, t)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-body-md font-semibold! text-text-primary">
                    {partyName(review.reviewer, t)}
                  </span>
                  <div className="flex items-center gap-2">
                    <StarRating
                      rating={review.rating}
                      reviews={0}
                      className="[&>span:last-child]:hidden"
                    />
                    <span className="text-body-sm text-text-tertiary">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              {review.serviceName ? (
                <span className="w-fit rounded-full bg-bg-sunken px-2.5 py-1 text-body-sm text-text-secondary">
                  {review.serviceName}
                </span>
              ) : null}
              {review.content ? (
                <p className="text-body-md text-text-secondary">
                  {review.content}
                </p>
              ) : null}

              {review.response ? (
                <div className="border-l-2 border-brand-primary pl-3">
                  <p className="text-body-sm text-text-secondary">
                    {review.response}
                  </p>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-fit"
                  onClick={() => setRespondTarget(review)}
                >
                  {t("respond")}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {respondTarget ? (
        <RespondReviewModal
          open={Boolean(respondTarget)}
          onOpenChange={(open) => !open && setRespondTarget(null)}
          reviewId={respondTarget.id}
          reviewerName={partyName(respondTarget.reviewer, t)}
          rating={respondTarget.rating}
          content={respondTarget.content}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
