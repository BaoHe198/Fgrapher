import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { FgImage } from "@/components/ui/fg-image";
import { ROLE_PHOTOS } from "@/lib/constants/showcase-images";

// "Thêm từ Fgrapher": one photo card per extra product that is switched
// on - Chợ F, Cộng đồng F - built from the flags, so with both off the
// whole section is gone rather than left empty. Photo cards since
// 16/11/2026 (owner): two grey boxes undersold two whole products. Fixed
// showcase artwork, like the role tiles.
const PHOTO = {
  market: ROLE_PHOTOS.CAMERA_SHOP[0].src,
  community: ROLE_PHOTOS.STUDIO[0].src,
} as const;

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
      <h2 id="home-more" className="mb-5 text-display-md text-text-primary">
        {t("title")}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        {cards.map((card, index) => (
          <Link
            key={card.key}
            href={card.href}
            className="group/more focus-ring block rounded-[var(--fg-radius-lg)]"
          >
            <FgImage
              src={PHOTO[card.key]}
              alt=""
              rounded="lg"
              revealIndex={index}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-44 transition-[transform,box-shadow] duration-[var(--fg-dur-260)] ease-fg-out group-hover/more:-translate-y-1 group-hover/more:shadow-[var(--shadow-lg)] max-md:h-36 motion-reduce:group-hover/more:translate-y-0"
              imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/more:scale-[1.04]"
            >
              <span className="absolute inset-0 flex items-end justify-between gap-4 bg-gradient-to-r from-black/80 via-black/50 to-black/10 p-5 text-white">
                <span className="flex flex-col gap-1">
                  <strong className="text-heading-lg">
                    {t(`${card.key}.title`)}
                  </strong>
                  <span className="text-body-md text-white/85">
                    {t(`${card.key}.body`)}
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="size-5 shrink-0 transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/more:translate-x-0.5 group-hover/more:-translate-y-0.5"
                />
              </span>
            </FgImage>
          </Link>
        ))}
      </div>
    </section>
  );
}
