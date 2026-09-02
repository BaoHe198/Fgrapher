import type { Metadata } from "next";
import { Compass, ShieldCheck, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";

interface GuideSection {
  heading: string;
  steps: string[];
}

const GROUPS = [
  { key: "customer", id: "khach-hang", icon: UserRound },
  { key: "provider", id: "nha-cung-cap", icon: Compass },
  { key: "account", id: "tai-khoan", icon: ShieldCheck },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.guide");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/guide" },
  };
}

export default async function GuidePage() {
  const t = await getTranslations("publicPages.guide");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>
      <p className="mt-2 text-body-lg text-text-secondary">{t("subtitle")}</p>
      <p className="mt-4 text-body-md text-text-secondary">{t("intro")}</p>

      <nav
        aria-label={t("subtitle")}
        className="mt-6 flex flex-wrap gap-2 border-y border-border-subtle py-4"
      >
        {GROUPS.map(({ key, id, icon: Icon }) => (
          <a
            key={key}
            href={`#${id}`}
            className="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3.5 py-2 text-body-sm font-semibold! text-text-primary transition-colors duration-150 hover:bg-bg-sunken"
          >
            <Icon className="size-4 text-brand-primary" />
            {t(`tabs.${key}`)}
          </a>
        ))}
      </nav>

      {GROUPS.map(({ key, id, icon: Icon }) => {
        const sections = t.raw(`${key}.sections`) as GuideSection[];
        return (
          <section key={key} id={id} className="mt-12 scroll-mt-20">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--fg-radius-md)] bg-success-bg">
                <Icon className="size-[18px] text-brand-primary" />
              </div>
              <h2 className="text-heading-lg text-text-primary">
                {t(`tabs.${key}`)}
              </h2>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {sections.map((section, index) => (
                <Card key={section.heading} className="flex flex-col gap-2">
                  <h3 className="flex items-baseline gap-2 text-heading-md text-text-primary">
                    <span className="text-body-sm font-semibold! text-brand-primary">
                      {index + 1}.
                    </span>
                    {section.heading}
                  </h3>
                  <ul className="flex flex-col gap-2 pl-6 text-body-md text-text-secondary [&>li]:list-disc">
                    {section.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
