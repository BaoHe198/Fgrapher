import { useTranslations } from "next-intl";
import Link from "next/link";

import { LogoFull } from "@/components/brand/logo-full";
import { CookieSettingsLink } from "@/components/layout/cookie-settings-link";
import { features } from "@/lib/features";

const PROVIDER_LINKS = [
  { labelKey: "pricing", href: "/pricing" },
  { labelKey: "tools", href: "/pricing" },
  { labelKey: "sell", href: "/shop" },
  { labelKey: "guidelines", href: "/guidelines" },
] as const;

const COMPANY_LINKS = [
  { labelKey: "about", href: "/about" },
  { labelKey: "guide", href: "/guide" },
  { labelKey: "support", href: "/help" },
  { labelKey: "terms", href: "/terms" },
  { labelKey: "privacy", href: "/privacy" },
] as const;

export function Footer() {
  const t = useTranslations();
  const providerLinks = features.marketplaceEnabled
    ? PROVIDER_LINKS
    : PROVIDER_LINKS.filter((link) => link.labelKey !== "sell");

  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="mx-auto max-w-[1440px] px-8 py-14 max-md:px-5">
        {/* The "Khám phá" column of role links was removed (project owner,
            28/09/2026): it repeated the search filters and made the footer
            long on phones. Role pages reach search engines via the sitemap.
            With two link columns left, a grid spread them unevenly and left
            a gap on the right; the brand now anchors the left edge and the
            links sit together against the right one. */}
        <div className="flex justify-between gap-12 max-md:flex-col max-md:gap-8">
          <div className="flex max-w-[360px] flex-col gap-3">
            <LogoFull />
            <p className="text-body-sm text-text-secondary">
              {t("hero.title")}
            </p>
          </div>

          <div className="flex gap-24 max-lg:gap-16 max-md:grid max-md:grid-cols-2 max-md:gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-body-sm font-semibold! text-text-primary">
                {t("foot.providers")}
              </span>
              {providerLinks.map((link) => (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  className="text-body-sm text-text-secondary hover:text-text-primary"
                >
                  {t(`foot.${link.labelKey}`)}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-body-sm font-semibold! text-text-primary">
                {t("foot.company")}
              </span>
              {COMPANY_LINKS.map((link) => (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  className="text-body-sm text-text-secondary hover:text-text-primary"
                >
                  {t(`foot.${link.labelKey}`)}
                </Link>
              ))}
              <CookieSettingsLink label={t("foot.cookieSettings")} />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border-subtle pt-6 text-body-sm text-text-tertiary">
          {t("sharedComponents.footer.copyright")}
        </div>
      </div>
    </footer>
  );
}
