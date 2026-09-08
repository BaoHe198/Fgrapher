import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { SimplePage } from "@/components/sections/simple-page";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.pricing");
  return { title: t("pageTitle") };
}

// The full plan cards/comparison table/FAQ stay hidden per the project
// owner's explicit decision (commit 2a412e4) — re-confirmed when QA
// flagged this page as looking broken (no H1, no structure, a single
// floating sentence). What changed here is only the notice page's own
// structure: a real H1 + hierarchy via the same SimplePage shared
// component every other simple content page uses (/contact, /about, ...),
// spelling out who this applies to and what's included, not just the
// bare 30-day-notice sentence. Restore <PricingContent .../> (still in
// pricing-content.tsx, see git history) if the plan cards come back.
export default async function PricingPage() {
  const t = await getTranslations("publicPages.pricing");

  return (
    <SimplePage title={t("simpleTitle")} subtitle={t("simpleSubtitle")}>
      <ul>
        <li>{t("simpleBenefits.profile")}</li>
        <li>{t("simpleBenefits.bookings")}</li>
        <li>{t("simpleBenefits.noCard")}</li>
      </ul>
      <p>{t("freeDuringLaunch")}</p>
      <Button
        variant="accent"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/login?mode=register" />}
      >
        {t("signUpFree")}
      </Button>
    </SimplePage>
  );
}
