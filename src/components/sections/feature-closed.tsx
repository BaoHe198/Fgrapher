import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import NotFound from "@/app/not-found";
import { Button } from "@/components/ui/button";

// The 404 for a route whose feature flag is off (Core MVP pass, 02/10/2026):
// it says the feature has not opened yet, instead of "page not found",
// and points back to what does work. Next.js marks every not-found
// response noindex, and sitemap.ts already leaves these routes out. While
// the feature is on, a real miss (a deleted product) gets the usual page.
export async function FeatureClosed({
  feature,
  open,
}: {
  feature: "market" | "community";
  open: boolean;
}) {
  if (open) return <NotFound />;
  const t = await getTranslations("notFound.closed");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass aria-hidden className="size-14 text-text-tertiary" />
      <h1 className="text-display-lg text-text-primary">{t("title")}</h1>
      <p className="max-w-md text-body-md text-text-secondary">{t(feature)}</p>
      <Button
        variant="accent"
        size="lg"
        nativeButton={false}
        render={<Link href="/browse" />}
      >
        {t("browse")}
      </Button>
    </div>
  );
}
