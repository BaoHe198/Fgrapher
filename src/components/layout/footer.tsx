import { useTranslations } from "next-intl";
import Link from "next/link";

import { LogoFull } from "@/components/brand/logo-full";
import { features } from "@/lib/features";

const DISCOVER_ROLES = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
  "MODEL",
] as const;

const PROVIDER_LINKS = [
  { labelKey: "pricing", href: "/pricing" },
  { labelKey: "tools", href: "/pricing" },
  { labelKey: "sell", href: "/shop" },
  { labelKey: "guidelines", href: "/guidelines" },
] as const;

const COMPANY_LINKS = [
  { labelKey: "about", href: "/about" },
  { labelKey: "support", href: "/help" },
  { labelKey: "terms", href: "/terms" },
] as const;

export function Footer() {
  const t = useTranslations();
  const discoverRoles = features.marketplaceEnabled
    ? DISCOVER_ROLES
    : DISCOVER_ROLES.filter((role) => role !== "CAMERA_SHOP");
  const providerLinks = features.marketplaceEnabled
    ? PROVIDER_LINKS
    : PROVIDER_LINKS.filter((link) => link.labelKey !== "sell");

  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="mx-auto max-w-[1440px] px-8 py-14 max-md:px-5">
        <div className="grid grid-cols-4 gap-8 max-md:grid-cols-1">
          <div className="flex flex-col gap-3">
            <LogoFull />
            <p className="text-body-sm text-text-secondary">
              {t("hero.title")}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {t("foot.discover")}
            </span>
            {discoverRoles.map((role) => (
              <Link
                key={role}
                href={`/browse?role=${role}`}
                className="text-body-sm text-text-secondary hover:text-text-primary"
              >
                {t(`role.${role}`)}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
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
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
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
          </div>
        </div>

        <div className="mt-10 border-t border-border-subtle pt-6 text-body-sm text-text-tertiary">
          {t("sharedComponents.footer.copyright")}
        </div>
      </div>
    </footer>
  );
}
