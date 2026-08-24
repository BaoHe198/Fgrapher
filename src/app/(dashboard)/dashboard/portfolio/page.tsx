import { Camera } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SubscriptionGate } from "@/components/subscription-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";
import { Tag } from "@/components/ui/tag";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES, ROLE_LABELS } from "@/lib/constants";

import { PortfolioGrid } from "./portfolio-grid";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const t = await getTranslations("dashboardCore.portfolio");

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const canUpload = session.user.roles.some((role) => role !== "CUSTOMER");
  if (!canUpload) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Camera className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">
          {t("proOnly.title")}
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          {t("proOnly.body")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/settings/roles" />}
        >
          {t("proOnly.cta")}
        </Button>
      </Card>
    );
  }

  const profiles = await db.profile.findMany({
    where: { userId: session.user.id, role: { in: PAID_ROLES } },
    orderBy: { createdAt: "asc" },
  });

  if (profiles.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Camera className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">
          {t("noProfile.title")}
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          {t("noProfile.body")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/settings/profile" />}
        >
          {t("noProfile.cta")}
        </Button>
      </Card>
    );
  }

  const { profile: profileParam } = await searchParams;
  const activeProfile =
    profiles.find((p) => p.role === profileParam) ?? profiles[0];

  const media = await db.profileMedia.findMany({
    where: { profileId: activeProfile.id },
    orderBy: { order: "asc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("sectionTitle")} />

      {profiles.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <Tag
              key={p.id}
              selected={p.id === activeProfile.id}
              render={<Link href={`/dashboard/portfolio?profile=${p.role}`} />}
            >
              {ROLE_LABELS[p.role]}
            </Tag>
          ))}
        </div>
      ) : null}

      <SubscriptionGate
        role={activeProfile.role}
        fallbackTitle={t("gate.fallbackTitle", {
          role: ROLE_LABELS[activeProfile.role],
        })}
        fallbackText={t("gate.fallbackText")}
      >
        <PortfolioGrid
          key={activeProfile.id}
          profileId={activeProfile.id}
          initialMedia={media.map((m) => ({
            id: m.id,
            url: m.url,
            type: m.type,
            title: m.title,
            moderationStatus: m.moderationStatus,
            moderationNote: m.moderationNote,
          }))}
        />
      </SubscriptionGate>
    </div>
  );
}
