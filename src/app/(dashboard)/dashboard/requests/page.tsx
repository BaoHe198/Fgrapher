import type { Metadata } from "next";
import { CalendarDays, MapPin, Plus, Send, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatBudgetRange } from "@/lib/utils";
import { listCustomerRequests } from "@/services/service-requests";

const STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING_REVIEW: "warning",
  OPEN: "warning",
  HAS_OFFERS: "warning",
  FULFILLED: "success",
  EXPIRED: "neutral",
  CANCELLED: "destructive",
  REJECTED: "destructive",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardCore.serviceRequests");
  return { title: t("title") };
}

export default async function ServiceRequestsPage() {
  const t = await getTranslations("dashboardCore.serviceRequests");
  const roleT = await getTranslations("role");
  const statusT = await getTranslations("dashboardCore.serviceRequests.status");

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const requests = await listCustomerRequests(session.user.id);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <SectionHead title={t("title")} as="h1" />
        <Button
          variant="accent"
          size="sm"
          nativeButton={false}
          render={<Link href="/requests/new" />}
        >
          <Plus className="size-4" />
          {t("newRequest")}
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Send className="size-10 text-text-tertiary" />
          <p className="text-body-md font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-sm text-text-secondary">{t("empty.body")}</p>
          <Button
            variant="accent"
            size="sm"
            nativeButton={false}
            render={<Link href="/requests/new" />}
          >
            {t("newRequest")}
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <Link key={request.id} href={`/dashboard/requests/${request.id}`}>
              <Card interactive className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold! text-text-primary">
                      {request.isDraft ? `${t("draftPrefix")} ` : ""}
                      {request.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {request.code} · {roleT(request.role)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.isDraft
                        ? "neutral"
                        : STATUS_VARIANT[request.status]
                    }
                  >
                    {request.isDraft
                      ? t("draftBadge")
                      : statusT(request.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-body-sm font-semibold!">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-gold-800">
                    <WalletCards className="size-4" />
                    {formatBudgetRange(request.budgetMin, request.budgetMax) ??
                      t("budgetNotSet")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1.5 text-info">
                    <MapPin className="size-4" />
                    {request.ward ? `${request.ward.name}, ` : ""}
                    {request.province.name}
                  </span>
                  <span className="ml-auto text-text-secondary">
                    {t("offerCount", { count: request._count.offers })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                    <CalendarDays className="size-4" />
                    {formatDate(request.createdAt)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
