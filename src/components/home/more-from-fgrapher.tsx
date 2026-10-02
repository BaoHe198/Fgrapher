import { getTranslations } from "next-intl/server";
import Link from "next/link";

// "Thêm từ Fgrapher" (Core MVP pass, 02/10/2026): one quiet card per extra
// product that is switched on - Chợ F, Cộng đồng F - built from the flags,
// so with both off the whole section is gone rather than left empty.
export async function MoreFromFgrapher({
  marketplaceEnabled,
  socialFeedEnabled,
}: {
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
}) {
  const t = await getTranslations("home.more");
  const cards = [
    marketplaceEnabled && { href: "/shop", key: "market" as const },
    socialFeedEnabled && { href: "/community", key: "community" as const },
  ].filter((card) => card !== false);
  if (cards.length === 0) return null;

  return (
    <section
      aria-labelledby="home-more"
      className="mx-auto max-w-[1440px] px-8 pt-16 max-md:px-5 max-md:pt-10"
    >
      <h2 id="home-more" className="mb-4 text-heading-lg text-text-primary">
        {t("title")}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="focus-ring flex flex-col gap-1 rounded-[var(--fg-radius-lg)] bg-bg-sunken p-5 text-text-primary transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-surface hover:shadow-[var(--shadow-sm)]"
          >
            <strong className="text-body-lg font-semibold">
              {t(`${card.key}.title`)}
            </strong>
            <span className="text-body-sm text-text-secondary">
              {t(`${card.key}.body`)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
