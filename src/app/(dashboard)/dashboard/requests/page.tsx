import { Plus, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import { listCustomerRequests } from "@/services/service-requests";

const STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "neutral" | "destructive"
> = {
  OPEN: "warning",
  HAS_OFFERS: "warning",
  FULFILLED: "success",
  EXPIRED: "neutral",
  CANCELLED: "destructive",
};

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
        <SectionHead title={t("title")} />
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
              <Card className="flex flex-col gap-2 transition-shadow duration-150 hover:shadow-[var(--shadow-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold! text-text-primary">
                      {request.isDraft ? `${t("draftPrefix")} ` : ""}
                      {request.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {request.code} · {roleT(request.role)} ·{" "}
                      {request.province.name}
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
                <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
                  <span>
                    {request.budgetMin || request.budgetMax
                      ? `${formatCurrency(request.budgetMin ?? 0)} – ${formatCurrency(request.budgetMax ?? 0)}`
                      : t("budgetNotSet")}
                  </span>
                  <span>·</span>
                  <span>
                    {t("offerCount", { count: request._count.offers })}
                  </span>
                  <span>·</span>
                  <span>{formatDate(request.createdAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
