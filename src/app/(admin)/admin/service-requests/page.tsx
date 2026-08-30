import { Handshake } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import { listUnclaimedRequests } from "@/services/service-requests";

export default async function AdminServiceRequestsPage() {
  const t = await getTranslations("accountFlows.admin.serviceRequests");
  const roleT = await getTranslations("role");

  const requests = await listUnclaimedRequests();

  // Server Component — renders once per request on the server, never
  // reconciled/memoized by the (client-only) React Compiler, so a
  // one-time Date.now() read here can't produce the stale-UI problem
  // this rule guards against (same reasoning as past-due-banner.tsx).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("description")}</p>
      </div>

      {requests.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Handshake className="size-10 text-text-tertiary" />
          <p className="text-body-md font-semibold! text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => {
            const hoursSincePosted = Math.round(
              (nowMs - request.createdAt.getTime()) / 3_600_000,
            );
            return (
              <Card key={request.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold! text-text-primary">
                      {request.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {request.code} · {roleT(request.role)} ·{" "}
                      {request.province.name}
                    </p>
                  </div>
                  <Badge
                    variant={hoursSincePosted >= 48 ? "destructive" : "warning"}
                  >
                    {t("hoursOpen", { hours: hoursSincePosted })}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
                  <span>
                    {request.customer.firstName ??
                      request.customer.name ??
                      request.customer.email}
                  </span>
                  <span>·</span>
                  <span>
                    {request.budgetMin || request.budgetMax
                      ? `${formatCurrency(request.budgetMin ?? 0)} – ${formatCurrency(request.budgetMax ?? 0)}`
                      : t("budgetNotSet")}
                  </span>
                  <span>·</span>
                  <span>{formatDateTime(request.createdAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
