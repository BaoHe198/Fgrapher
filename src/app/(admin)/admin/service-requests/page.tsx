import { Clock3, Handshake, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ReferenceMediaGallery } from "@/components/media/reference-media-gallery";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { resolvePartyName } from "@/lib/party-name";
import { formatBudgetRange } from "@/lib/utils";
import { listServiceRequestsForAdmin } from "@/services/service-requests";

import { ServiceRequestReviewActions } from "./service-request-review-actions";

export default async function AdminServiceRequestsPage() {
  const t = await getTranslations("accountFlows.admin.serviceRequests");
  const roleT = await getTranslations("role");
  const categoryT = await getTranslations("profileCategory");

  const { pending, unclaimed } = await listServiceRequestsForAdmin();

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

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand-primary" />
          <h2 className="text-heading-md text-text-primary">
            {t("pendingHeading", { count: pending.length })}
          </h2>
        </div>

        {pending.length === 0 ? (
          <Card className="py-8 text-center text-body-sm text-text-secondary">
            {t("pendingEmpty")}
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((request) => (
              <Card key={request.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-heading-sm text-text-primary">
                      {request.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {request.code} · {request.province.name}
                      {request.ward ? `, ${request.ward.name}` : ""} ·{" "}
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <Badge variant="warning">{roleT(request.role)}</Badge>
                </div>

                <p className="text-body-sm text-text-secondary">
                  {t("submittedBy", {
                    name: resolvePartyName(
                      request.customer,
                      request.customer.email,
                    ),
                  })}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {request.categories.map((category) => (
                    <Badge key={category} variant="neutral">
                      {categoryT(category)}
                    </Badge>
                  ))}
                </div>

                {request.description ? (
                  <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
                    {request.description}
                  </p>
                ) : null}

                <p className="text-body-sm font-semibold! text-gold-800">
                  {formatBudgetRange(request.budgetMin, request.budgetMax) ??
                    t("budgetNotSet")}
                </p>

                <ReferenceMediaGallery
                  urls={request.references.map(
                    (reference) => reference.mediaUrl,
                  )}
                  label={t("referencesLabel")}
                />

                <ServiceRequestReviewActions requestId={request.id} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5 text-text-secondary" />
          <h2 className="text-heading-md text-text-primary">
            {t("unclaimedHeading", { count: unclaimed.length })}
          </h2>
        </div>

        {unclaimed.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <Handshake className="size-9 text-text-tertiary" />
            <p className="text-body-sm text-text-secondary">
              {t("unclaimedEmpty")}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {unclaimed.map((request) => {
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
                      variant={
                        hoursSincePosted >= 48 ? "destructive" : "warning"
                      }
                    >
                      {t("hoursOpen", { hours: hoursSincePosted })}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
                    <span>
                      {resolvePartyName(
                        request.customer,
                        request.customer.email,
                      )}
                    </span>
                    <span>·</span>
                    <span>
                      {formatBudgetRange(
                        request.budgetMin,
                        request.budgetMax,
                      ) ?? t("budgetNotSet")}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(request.createdAt)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
