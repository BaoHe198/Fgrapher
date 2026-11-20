import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";

import { ServicesManager } from "../settings/profile/services-manager";

export async function generateMetadata() {
  const t = await getTranslations("dashboardCore.myPage.services");
  return { title: t("metaTitle") };
}

/**
 * "Trang của tôi → Gói dịch vụ": the packages customers book. They were the
 * last block of the long Settings → Profile form, below the address and the
 * model measurements.
 */
export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.roles.find((r) => PROVIDER_ROLES.includes(r));
  if (!role) redirect("/dashboard/my-page");

  const t = await getTranslations("dashboardCore.myPage.services");
  const profile = await db.profile.findUnique({
    where: { userId_role: { userId: session.user.id, role } },
    select: {
      id: true,
      services: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          name: true,
          description: true,
          duration: true,
          price: true,
          currency: true,
          isActive: true,
          editedPhotoCount: true,
          deliveryDays: true,
        },
      },
    },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("lede")}</p>
      </div>
      {profile ? (
        <ServicesManager
          profileId={profile.id}
          role={role}
          initialServices={profile.services}
        />
      ) : (
        // Profile rows are created on the first save of the profile form.
        <div className="flex flex-col items-start gap-3 rounded-[var(--fg-radius-lg)] border border-dashed border-border-default p-5">
          <p className="text-body-md text-text-primary">{t("needProfile")}</p>
          <Link
            href="/dashboard/my-page/info"
            className={buttonVariants({ variant: "accent" })}
          >
            {t("needProfileCta")}
          </Link>
        </div>
      )}
    </div>
  );
}
