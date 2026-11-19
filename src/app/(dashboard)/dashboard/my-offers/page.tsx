import type { Metadata } from "next";
import { Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { offerDisplayStatus } from "@/lib/request-offer-status";
import { formatCurrency } from "@/lib/utils";
import { listProviderOffers } from "@/services/request-offers";

const STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "destructive",
  WITHDRAWN: "neutral",
  REQUEST_CANCELLED: "neutral",
  REQUEST_EXPIRED: "neutral",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardCore.myOffers");
  return { title: t("title") };
}

export default async function MyOffersPage() {
  const t = await getTranslations("dashboardCore.myOffers");

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const offers = await listProviderOffers(session.user.id);

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("title")} as="h1" />

      {offers.length === 0 ? (
        <EmptyState
          icon={<Send />}
          title={t("empty.title")}
          description={t("empty.body")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => {
            const shown = offerDisplayStatus(
              offer.status,
              offer.request.status,
            );
            return (
              <Link
                key={offer.id}
                href={`/dashboard/opportunities/${offer.request.id}?role=${offer.request.role}`}
              >
                <Card interactive className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold! text-text-primary">
                        {offer.request.title}
                      </p>
                      <p className="text-body-sm text-text-tertiary">
                        {offer.request.code} · {offer.request.province.name}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[shown]}>
                      {t(`status.${shown}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
                    <span>{formatCurrency(offer.proposedPrice)}</span>
                    <span>·</span>
                    <span>{formatDate(offer.createdAt)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
