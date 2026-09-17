import type { Role } from "@prisma/client";
import type { Metadata } from "next";
import { CalendarDays, Handshake, MapPin, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { Tag } from "@/components/ui/tag";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { formatBudgetRange } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { listOpportunitiesForProvider } from "@/services/request-offers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardCore.opportunities");
  return { title: t("title") };
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const t = await getTranslations("dashboardCore.opportunities");
  const roleT = await getTranslations("role");
  const categoryT = await getTranslations("profileCategory");

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const providerRoles = await db.userRole.findMany({
    where: {
      userId: session.user.id,
      active: true,
      role: { in: PROVIDER_ROLES },
    },
    select: { role: true },
  });

  if (providerRoles.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Handshake className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold! text-text-primary">
          {t("proOnly.title")}
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          {t("proOnly.body")}
        </p>
      </Card>
    );
  }

  const { role: roleParam } = await searchParams;
  const activeRole =
    providerRoles.find((r) => r.role === roleParam)?.role ??
    providerRoles[0].role;

  const opportunities = await listOpportunitiesForProvider(
    session.user.id,
    activeRole as Role,
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("title")} as="h1" />

      {providerRoles.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {providerRoles.map((r) => (
            <Tag
              key={r.role}
              selected={r.role === activeRole}
              render={<Link href={`/dashboard/opportunities?role=${r.role}`} />}
            >
              {roleT(r.role)}
            </Tag>
          ))}
        </div>
      ) : null}

      {opportunities.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Handshake className="size-10 text-text-tertiary" />
          <p className="text-body-md font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-sm text-text-secondary">{t("empty.body")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {opportunities.map((request) => {
            const myOffer = request.offers[0];
            return (
              <Link
                key={request.id}
                href={`/dashboard/opportunities/${request.id}?role=${activeRole}`}
              >
                <Card interactive className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold! text-text-primary">
                        {request.title}
                      </p>
                      <p className="text-body-sm text-text-tertiary">
                        {request.code}
                      </p>
                    </div>
                    {myOffer ? (
                      <span className="shrink-0 rounded-full bg-bg-sunken px-2.5 py-1 text-body-sm font-semibold! text-text-secondary">
                        {t(`myOfferStatus.${myOffer.status}`)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {request.categories.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-bg-sunken px-2.5 py-1 text-body-sm text-text-secondary"
                      >
                        {categoryT(c)}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-body-sm font-semibold!">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-gold-800">
                      <WalletCards className="size-4" />
                      {formatBudgetRange(
                        request.budgetMin,
                        request.budgetMax,
                      ) ?? t("budgetNotSet")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1.5 text-info">
                      <MapPin className="size-4" />
                      {request.ward ? `${request.ward.name}, ` : ""}
                      {request.province.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-text-secondary">
                      <CalendarDays className="size-4" />
                      {request.isDateFlexible
                        ? t("flexible")
                        : request.shootDate
                          ? formatDate(request.shootDate)
                          : "—"}
                    </span>
                    <span className="ml-auto text-text-tertiary">
                      {t("offerCount", { count: request._count.offers })}
                    </span>
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
