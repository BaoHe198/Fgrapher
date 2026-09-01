import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SimplePage } from "@/components/sections/simple-page";

const FAQ_KEYS = [
  "becomeProvider",
  "howBookingWorks",
  "isFree",
  "howToContactSupport",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.help");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/help" },
  };
}

export default async function HelpPage() {
  const t = await getTranslations("publicPages.help");

  const faqs = FAQ_KEYS.map((key) => ({
    q: t(`faqs.${key}.q`),
    a: t(`faqs.${key}.a`),
  }));

  // FAQPage structured data — matches the pattern already used on the
  // role/province landing page (services/search results' CollectionPage
  // JSON-LD) for rich-result eligibility.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <SimplePage title={t("title")} subtitle={t("subtitle")}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col gap-6">
        {faqs.map((item) => (
          <div key={item.q} className="flex flex-col gap-1.5">
            <h2 className="text-heading-md text-text-primary">{item.q}</h2>
            <p>{item.a}</p>
          </div>
        ))}
      </div>
    </SimplePage>
  );
}
