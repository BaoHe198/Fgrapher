import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { FgImage } from "@/components/ui/fg-image";
import { cn } from "@/lib/utils";
import { RiseOnView } from "@/components/ui/rise-on-view";
import type { HomeStyleTile } from "@/services/home";

interface StyleGridProps {
  tiles: HomeStyleTile[];
}

// "Duyệt theo phong cách" - each style is a three-frame cut of a contact
// sheet (one large frame, two small) of fixed showcase artwork
// (lib/constants/showcase-images.ts), opening search filtered to that
// style. A style without photos is left out, and the block disappears if
// none has any. Phones skip this block (the design's mobile home filters the featured list by
// style instead).
export async function StyleGrid({ tiles }: StyleGridProps) {
  const t = await getTranslations();
  const shown = tiles.filter((tile) => tile.photoUrls.length > 0);
  if (shown.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-8 pt-16 max-md:hidden">
      <RiseOnView>
        <h2 className="mb-5 text-display-md text-text-primary">
          {t("home.stylesTitle")}
        </h2>
      </RiseOnView>
      <ul className="grid grid-cols-3 gap-x-5 gap-y-6 max-lg:grid-cols-2">
        {shown.map((tile, index) => {
          const [big, ...small] = tile.photoUrls;
          const label = t(`profileCategory.${tile.category}`);
          return (
            <li key={tile.category}>
              <Link
                href={`/browse?categories=${tile.category}`}
                className="group/style focus-ring flex flex-col gap-2.5 rounded-[var(--fg-radius-sm)]"
              >
                {/* One, two or three frames: the large frame always
                    leads, and fewer photos widen it instead of leaving
                    holes. */}
                <div
                  className={cn(
                    "grid aspect-[16/10] gap-1.5 transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/style:-translate-y-0.5 motion-reduce:group-hover/style:translate-y-0",
                    small.length === 0
                      ? "grid-cols-1"
                      : small.length === 1
                        ? "grid-cols-[2fr_1fr]"
                        : "grid-cols-[2fr_1fr] grid-rows-2",
                  )}
                >
                  <FgImage
                    src={big}
                    alt=""
                    revealIndex={index}
                    sizes="(min-width: 1024px) 22vw, 32vw"
                    className={cn(small.length === 2 && "row-span-2")}
                    imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/style:scale-[1.03]"
                  />
                  {small.map((url, slot) => (
                    <FgImage
                      key={url}
                      src={url}
                      alt=""
                      revealIndex={index + slot + 1}
                      sizes="(min-width: 1024px) 11vw, 16vw"
                    />
                  ))}
                </div>
                <span className="text-heading-sm text-text-primary">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
