import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { FgImage } from "@/components/ui/fg-image";
import { RiseOnView } from "@/components/ui/rise-on-view";
import type { HomeRoleTile } from "@/services/home";

// Brand artwork for the four roles the hero already illustrates, used
// until a provider of that role has an approved photo to show instead.
const FALLBACK_PHOTO: Partial<Record<Role, string>> = {
  PHOTOGRAPHER: "/images/hero-professions/photographer.jpg",
  VIDEOGRAPHER: "/images/hero-professions/videographer.jpg",
  MAKEUP_ARTIST: "/images/hero-professions/makeup-artist.jpg",
  STUDIO: "/images/hero-professions/studio.jpg",
};

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
      photo: tile.photoUrl ?? FALLBACK_PHOTO[tile.role] ?? null,
      phoneOnly: false,
    })),
    ...(marketplaceEnabled
      ? [
          {
            key: "CAMERA_SHOP",
            href: "/shop",
            label: t("roleTiles.CAMERA_SHOP"),
            photo: null,
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
              className="group/tile focus-ring flex flex-col gap-2 rounded-[var(--fg-radius-sm)]"
            >
              <FgImage
                src={item.photo}
                alt=""
                ratio="4/5"
                revealIndex={index}
                sizes="(min-width: 768px) 16vw, 132px"
                className="transition-[transform,box-shadow] duration-[var(--fg-dur-260)] ease-fg-out group-hover/tile:-translate-y-0.5 group-hover/tile:shadow-[var(--shadow-md)] motion-reduce:group-hover/tile:translate-y-0"
                imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/tile:scale-[1.03]"
              />
              <span className="text-body-sm font-semibold! text-text-primary">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
