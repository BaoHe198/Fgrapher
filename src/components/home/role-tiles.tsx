import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { FgImage } from "@/components/ui/fg-image";
import { RiseOnView } from "@/components/ui/rise-on-view";
import { ROLE_PHOTOS } from "@/lib/constants/showcase-images";
import type { HomeRoleTile } from "@/services/home";

interface RoleTilesProps {
  tiles: HomeRoleTile[];
  /** Adds the Chợ F tile (phones only, as in the design). */
  marketplaceEnabled: boolean;
}

// "Bạn cần ai?" - one photo tile per role, each opening search filtered to
// that role. Six across on a desktop; a sideways-scrolling strip on phones.
export async function RoleTiles({ tiles, marketplaceEnabled }: RoleTilesProps) {
  const t = await getTranslations("home");
  const items = [
    ...tiles.map((tile) => ({
      key: tile.role,
      href: `/browse?roles=${tile.role}`,
      label: t(`roleTiles.${tile.role}`),
      photo: tile.photoUrl,
      phoneOnly: false,
    })),
    ...(marketplaceEnabled
      ? [
          {
            key: "CAMERA_SHOP",
            href: "/shop",
            label: t("roleTiles.CAMERA_SHOP"),
            photo: ROLE_PHOTOS.CAMERA_SHOP[0].src,
            phoneOnly: true,
          },
        ]
      : []),
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-8 pt-16 max-md:px-5 max-md:pt-10">
      <RiseOnView>
        <h2 className="mb-5 text-display-md text-text-primary">
          {t("whoTitle")}
        </h2>
      </RiseOnView>
      <ul className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <li
            key={item.key}
            className={
              item.phoneOnly
                ? "w-[132px] shrink-0 snap-start md:hidden"
                : "w-[132px] shrink-0 snap-start md:w-auto"
            }
          >
            <Link
              href={item.href}
              data-viewfinder
              data-shutter
              className="group/tile focus-ring block rounded-[var(--fg-radius-md)]"
            >
              {/* The label sits on the photo (owner, 16/11/2026): the tile
                  reads as one picture, not a thumbnail with a caption. */}
              <FgImage
                src={item.photo}
                alt=""
                ratio="3/4"
                rounded="md"
                revealIndex={index}
                sizes="(min-width: 768px) 16vw, 132px"
                className="transition-[transform,box-shadow] duration-[var(--fg-dur-260)] ease-fg-out group-hover/tile:-translate-y-1 group-hover/tile:shadow-[var(--shadow-lg)] motion-reduce:group-hover/tile:translate-y-0"
                imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/tile:scale-[1.06]"
              >
                <span
                  aria-hidden
                  className="viewfinder bottom-12! max-md:hidden"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pt-10 pb-3 text-white">
                  <span className="text-heading-sm max-md:text-body-sm max-md:font-semibold!">
                    {item.label}
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-[var(--fg-dur-260)] ease-fg-out group-hover/tile:translate-x-0 group-hover/tile:opacity-100 max-md:hidden"
                  />
                </span>
              </FgImage>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
