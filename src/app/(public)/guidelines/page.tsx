import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SimplePage } from "@/components/sections/simple-page";

const SECTION_KEYS = [
  "ageRequirement",
  "moderation",
  "violations",
  "appeals",
  "reporting",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.guidelines");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/guidelines" },
  };
}

export default async function GuidelinesPage() {
  const t = await getTranslations("publicPages.guidelines");
  const prohibitedItems = t.raw("prohibited.items") as string[];

  return (
    <SimplePage title={t("title")} subtitle={t("subtitle")}>
      <p>{t("intro")}</p>

      <h2>{t("prohibited.heading")}</h2>
      <ul>
        {prohibitedItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {SECTION_KEYS.map((key) => (
        <div key={key}>
          <h2>{t(`${key}.heading`)}</h2>
          <p>{t(`${key}.body`)}</p>
        </div>
      ))}
    </SimplePage>
  );
}
