"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FgImage } from "@/components/ui/fg-image";
import { cn } from "@/lib/utils";

export interface RowArtist {
  id: string;
  username: string;
  name: string;
  /** "Nhiếp ảnh gia ở Thủ Đức, TP. Hồ Chí Minh". */
  subtitle: string;
  cover: string | null;
  /** "1.500.000₫", or null when the artist quotes on request. */
  priceFrom: string | null;
  /** "4,9", or null before the first review. */
  rating: string | null;
  reviews: number;
  /** "Được yêu thích": only from real reviews (see the page). */
  favourite: boolean;
}

// One horizontal row of the Airbnb-style home page (owner, 17/11/2026): a
// title that links to the full search, two round arrows that page the row,
// and square photo cards - name, what and where, then the price and rating
// on one line. The row scrolls by touch or trackpad as well; the arrows
// only appear where there is somewhere to go.
export function ArtistRow({
  title,
  href,
  artists,
}: {
  title: string;
  href: string;
  artists: RowArtist[];
}) {
  const t = useTranslations("home.rows");
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: dir * el.clientWidth * 0.9,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  if (artists.length === 0) return null;

  const arrow =
    "focus-ring flex size-8 items-center justify-center rounded-full border border-border-default bg-bg-surface text-text-primary transition-[opacity,transform] duration-[var(--fg-dur-150)] hover:scale-105 hover:shadow-[var(--shadow-sm)] disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100";

  return (
    <section className="mx-auto max-w-[1440px] px-8 pt-10 max-md:px-5 max-md:pt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-heading-xl text-text-primary max-md:text-heading-lg">
          <Link
            href={href}
            className="group/title focus-ring inline-flex items-center gap-2"
          >
            {title}
            <ArrowRight
              aria-hidden
              className="size-5 transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/title:translate-x-1"
            />
          </Link>
        </h2>
        <div className="flex gap-2 max-md:hidden">
          <button
            type="button"
            aria-label={t("previous")}
            disabled={edges.start}
            onClick={() => page(-1)}
            className={arrow}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("next")}
            disabled={edges.end}
            onClick={() => page(1)}
            className={arrow}
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <ul
        ref={scroller}
        className="-mx-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-8 px-8 pb-2 [scrollbar-width:none] max-md:-mx-5 max-md:scroll-px-5 max-md:px-5 [&::-webkit-scrollbar]:hidden"
      >
        {artists.map((artist, index) => (
          <li
            key={artist.id}
            className="w-[calc((100%-4rem)/5)] shrink-0 snap-start max-xl:w-[calc((100%-3rem)/4)] max-lg:w-[calc((100%-2rem)/3)] max-md:w-[44%] max-sm:w-[66%]"
          >
            <Link
              href={`/profile/${artist.username}`}
              data-shutter
              className="group/card focus-ring flex flex-col gap-2.5 rounded-[var(--fg-radius-lg)]"
            >
              <FgImage
                src={artist.cover}
                alt=""
                ratio="1/1"
                rounded="lg"
                revealIndex={index}
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 66vw"
                imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/card:scale-[1.04] motion-reduce:group-hover/card:scale-100"
              >
                {artist.favourite || !artist.rating ? (
                  <span className="absolute top-3 left-3 rounded-full bg-bg-surface/95 px-2.5 py-1 text-meta font-semibold! text-text-primary shadow-[var(--shadow-sm)]">
                    {artist.favourite ? t("favourite") : t("new")}
                  </span>
                ) : null}
              </FgImage>
              <div className="flex flex-col gap-0.5 px-0.5">
                <span className="truncate text-body-md font-semibold! text-text-primary">
                  {artist.name}
                </span>
                <span className="truncate text-body-sm text-text-secondary">
                  {artist.subtitle}
                </span>
                <span className="flex items-center gap-1 text-body-sm text-text-secondary">
                  <span className={cn(artist.priceFrom && "text-text-primary")}>
                    {artist.priceFrom
                      ? t("from", { price: artist.priceFrom })
                      : t("askPrice")}
                  </span>
                  {artist.rating ? (
                    <>
                      <span aria-hidden>·</span>
                      <Star aria-hidden className="size-3 fill-current" />
                      <span>
                        {artist.rating} ({artist.reviews})
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
