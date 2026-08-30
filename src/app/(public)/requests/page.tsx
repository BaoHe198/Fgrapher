import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listProvinces } from "@/services/geography";

import { BrowseRequestsClient } from "./browse-requests-client";

export default async function BrowseRequestsPage() {
  const t = await getTranslations("dashboardCore.browseRequests");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const provinces = await listProvinces();

  return (
    <BrowseRequestsClient
      heading={t("heading")}
      subheading={t("subheading")}
      provinces={provinces.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      }))}
    />
  );
}
