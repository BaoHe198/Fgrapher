import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PAID_ROLES, PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";

import { AccountBasicsForm } from "../../settings/profile/account-basics-form";
import { AccountMedia } from "../../settings/profile/account-media";
import { RoleProfileSwitcher } from "../../settings/profile/role-profile-switcher";

export async function generateMetadata() {
  const t = await getTranslations("dashboardCore.myPage.info");
  return { title: t("metaTitle") };
}

/**
 * "Trang của tôi → Thông tin": the photos, name, introduction, area,
 * policies and links customers see. Was the "Hồ sơ theo vai trò" panel of
 * Settings → Profile, behind an accordion next to the password; service
 * packages moved to /dashboard/services and working hours to the calendar.
 */
export default async function MyPageInfo() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles.filter((role) =>
    (PAID_ROLES as string[]).includes(role),
  );
  if (roles.length === 0) redirect("/dashboard/settings/profile");

  const t = await getTranslations("dashboardCore.myPage.info");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { ward: { select: { provinceId: true } } },
  });
  const isProvider = roles.some((role) => PROVIDER_ROLES.includes(role));
  const jumps = [
    ["anh", "photos"],
    ["gioi-thieu", "intro"],
    ...(roles.includes("COSTUME_SHOP") ? [["costumes", "costumes"]] : []),
    ["khu-vuc", "area"],
    ...(isProvider ? [["chinh-sach", "policies"]] : []),
    ["lien-ket", "links"],
  ] as const;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("lede")}</p>
      </div>

      <nav aria-label={t("jumpLabel")} className="flex flex-wrap gap-2">
        {jumps.map(([id, key]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-10 items-center rounded-full border border-border-subtle px-3.5 text-body-sm font-semibold! text-text-secondary hover:bg-bg-sunken"
          >
            {t(`jump.${key}`)}
          </a>
        ))}
      </nav>

      <section
        id="anh"
        aria-labelledby="info-photos"
        className="flex scroll-mt-28 flex-col gap-4"
      >
        <h2 id="info-photos" className="text-heading-md text-text-primary">
          {t("photosHeading")}
        </h2>
        <AccountMedia
          initialAvatar={user.avatar}
          initialCoverImage={user.coverImage}
        />
        <AccountBasicsForm
          initialName={user.name}
          initialUsername={user.username}
          initialWardId={user.wardId}
          initialProvinceId={user.ward?.provinceId ?? null}
          showDisplayName={false}
        />
      </section>

      <section
        aria-labelledby="info-profile"
        className="flex flex-col gap-4 border-t border-border-subtle pt-6"
      >
        <h2 id="info-profile" className="text-heading-md text-text-primary">
          {t("profileHeading")}
        </h2>
        <RoleProfileSwitcher
          roles={roles}
          userId={session.user.id}
          showServices={false}
        />
      </section>
    </div>
  );
}
