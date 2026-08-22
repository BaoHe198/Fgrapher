import { useTranslations } from "next-intl";
import Link from "next/link";

import { LogoFull } from "@/components/brand/logo-full";

const DISCOVER_ROLES = [
  { role: "PHOTOGRAPHER", key: "Photographer" },
  { role: "VIDEOGRAPHER", key: "Videographer" },
  { role: "MAKEUP_ARTIST", key: "Make-up Artist" },
  { role: "STUDIO", key: "Studio" },
  { role: "CAMERA_SHOP", key: "Camera Shop" },
  { role: "MODEL", key: "Model" },
] as const;

const PROVIDER_LINKS = [
  { labelKey: "pricing", href: "/pricing" },
  { labelKey: "tools", href: "/pricing" },
  { labelKey: "sell", href: "/shop" },
  { labelKey: "guidelines", href: "/guidelines" },
] as const;

const COMPANY_LINKS = [
  { labelKey: "about", href: "/about" },
  { labelKey: "careers", href: "/careers" },
  { labelKey: "support", href: "/support" },
  { labelKey: "terms", href: "/terms" },
] as const;

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="mx-auto max-w-[1240px] px-8 py-14 max-md:px-5">
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
            {DISCOVER_ROLES.map(({ role, key }) => (
              <Link
                key={role}
                href={`/browse?role=${role}`}
                className="text-body-sm text-text-secondary hover:text-text-primary"
              >
                {t(`role.${key}`)}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {t("foot.providers")}
            </span>
            {PROVIDER_LINKS.map((link) => (
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
          © 2026 Fgrapher. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
