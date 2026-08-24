import { getTranslations } from "next-intl/server";

import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("dashboardSettings.layout");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>
      <SettingsNav />
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}
