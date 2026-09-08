import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES, PROVIDER_ROLES } from "@/lib/constants";

import { AccountBasicsForm } from "./account-basics-form";
import { AccountMedia } from "./account-media";
import { AvailabilitySettings } from "./availability-settings";
import { RoleProfileSwitcher } from "./role-profile-switcher";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("dashboardSettings.profile.sections");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });
  const providerRoles = session.user.roles.filter((role) =>
    (PAID_ROLES as string[]).includes(role),
  );
  const isProvider = session.user.roles.some((role) =>
    (PROVIDER_ROLES as string[]).includes(role),
  );

  // QA: this page stacked cover/avatar + basics + per-role profile (its
  // own tabs + a full ServicesManager list) + a 7-day availability grid
  // all always-expanded, making it very long to scroll through just to
  // reach one Save button. An Accordion (same shared component
  // PricingContent's FAQ already uses) splits it into sections a visitor
  // opens on purpose — each section's own existing Save button then sits
  // right where they're already looking, not several screens down.
  // "Thông tin cơ bản" defaults open since it's what most visits are for;
  // the others are one click away, never hidden.
  return (
    <Accordion defaultValue={["basics"]} className="flex flex-col">
      <AccordionItem value="basics">
        <AccordionTrigger>{t("basics")}</AccordionTrigger>
        <AccordionPanel>
          <div className="flex flex-col gap-6 pb-6">
            <AccountMedia
              initialAvatar={user.avatar}
              initialCoverImage={user.coverImage}
            />
            <AccountBasicsForm
              initialName={user.name}
              initialUsername={user.username}
              initialWardId={user.wardId}
              // Anyone with a provider role already sets a "Tên hiển thị"
              // per role below (RoleProfileSwitcher, backed by
              // Profile.displayName) — showing a second, account-level
              // name field here would just be the same concept twice.
              // Customers have no Profile at all, so this is their only
              // place to set one (backed by User.name instead).
              showDisplayName={providerRoles.length === 0}
            />
          </div>
        </AccordionPanel>
      </AccordionItem>

      {providerRoles.length > 0 ? (
        <AccordionItem value="roleProfile">
          <AccordionTrigger>{t("roleProfile")}</AccordionTrigger>
          <AccordionPanel>
            <div className="pb-6">
              <RoleProfileSwitcher roles={providerRoles} />
            </div>
          </AccordionPanel>
        </AccordionItem>
      ) : null}

      {isProvider ? (
        <AccordionItem value="availability">
          <AccordionTrigger>{t("availability")}</AccordionTrigger>
          <AccordionPanel>
            <div className="pb-6">
              <AvailabilitySettings />
            </div>
          </AccordionPanel>
        </AccordionItem>
      ) : null}
    </Accordion>
  );
}
