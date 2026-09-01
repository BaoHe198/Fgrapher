import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.pricing");
  return { title: t("pageTitle") };
}

// The full plan cards/comparison table/FAQ are temporarily hidden per
// the project owner's request — just this one notice stays up, since
// billing being manually-assigned-and-free isn't obvious otherwise.
// Restore <PricingContent .../> (see git history) to bring the rest
// back.
export default async function PricingPage() {
  const t = await getTranslations("publicPages.pricing");

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center sm:px-8">
      <p className="text-body-lg text-text-secondary">
        {t("freeDuringLaunch")}
      </p>
    </div>
  );
}
