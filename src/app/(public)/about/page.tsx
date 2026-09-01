import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SimplePage } from "@/components/sections/simple-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const t = await getTranslations("publicPages.about");
  return (
    <SimplePage title={t("title")} subtitle={t("subtitle")}>
      <p>{t("body1")}</p>
      <p>{t("body2")}</p>
    </SimplePage>
  );
}
