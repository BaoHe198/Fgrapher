import { Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
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
};

export default async function MyOffersPage() {
  const t = await getTranslations("dashboardCore.myOffers");

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const offers = await listProviderOffers(session.user.id);

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("title")} />

      {offers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Send className="size-10 text-text-tertiary" />
          <p className="text-body-md font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-sm text-text-secondary">{t("empty.body")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => (
            <Link
              key={offer.id}
              href={`/dashboard/opportunities/${offer.request.id}?role=${offer.request.role}`}
            >
              <Card className="flex flex-col gap-2 transition-shadow duration-150 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold! text-text-primary">
                      {offer.request.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {offer.request.code} · {offer.request.province.name}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[offer.status]}>
                    {t(`status.${offer.status}`)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
                  <span>{formatCurrency(offer.proposedPrice)}</span>
                  <span>·</span>
                  <span>{formatDate(offer.createdAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
