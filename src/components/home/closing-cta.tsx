import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Two closing cards on the same dark-green frame: providers on larger
// screens, "Đặt lịch F" (post a request, get offers) on phones - the
// design's mobile home swaps one for the other.
export async function ClosingCta() {
  const t = await getTranslations("home");
  return (
    <section className="mx-auto max-w-[1440px] px-8 py-20 max-md:px-5 max-md:py-10">
      <div className="flex items-end justify-between gap-8 rounded-[var(--fg-radius-xl)] bg-green-900 p-10 text-gold-50 max-md:hidden max-lg:flex-col max-lg:items-start">
        <div className="flex max-w-xl flex-col gap-3">
          <span className="font-mono text-meta tracking-[0.12em] text-gold-400 uppercase">
            {t("provider.eyebrow")}
          </span>
          <h2 className="text-display-md">{t("ctaTitle")}</h2>
          <p className="text-body-md text-green-200">{t("provider.sub")}</p>
        </div>
        <Button
          variant="accent"
          size="lg"
          className="shrink-0"
          nativeButton={false}
          render={<Link href="/login?mode=register" />}
        >
          {t("ctaBtn")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] bg-green-900 p-5 text-gold-50 md:hidden">
        <span className="font-mono text-meta tracking-[0.12em] text-gold-400 uppercase">
          {t("request.eyebrow")}
        </span>
        <h2 className="text-heading-lg">{t("request.title")}</h2>
        <Button
          variant="accent"
          className="self-start"
          nativeButton={false}
          render={<Link href="/requests/new" />}
        >
          {t("request.cta")}
        </Button>
      </div>
    </section>
  );
}
