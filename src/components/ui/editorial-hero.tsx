import * as React from "react";

import { cn } from "@/lib/utils";

import { FgImage } from "./fg-image";

// Magazine-style page head (wave 2 kit §02): a mono section eyebrow
// ("GIỚI THIỆU"), a title set as the image of the page, and beside
// it one large photo or a strip of contact-sheet frames. Text and buttons
// appear at once; only the photo develops. Colours follow the theme.

type Media =
  | { type: "image"; src: string | null; alt: string }
  | {
      type: "contact";
      /** Six to a row. `meta` sits under the photo. */
      frames: {
        src: string | null;
        /** Unique per frame; used as the list key, never shown. */
        label: string;
        alt?: string;
        meta?: string;
      }[];
      picked?: number;
      /** Optional caption pair printed above the sheet. */
      edge?: [string, string];
    };

interface EditorialHeroProps {
  section: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  media?: Media;
  /** At most two Buttons. */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function EditorialHero({
  section,
  title,
  lede,
  media,
  actions,
  className,
  children,
}: EditorialHeroProps) {
  return (
    <section data-slot="editorial-hero" className={cn("bg-bg-page", className)}>
      <div
        className={cn(
          "mx-auto grid max-w-[1440px] gap-10 px-8 py-14 max-md:gap-8 max-md:px-5 max-md:py-10",
          media?.type === "image" && "lg:grid-cols-[1.1fr_1fr] lg:items-end",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {section}
          </span>
          <h1 className="font-display text-[clamp(2.75rem,6.6vw,6rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-balance break-words text-text-primary">
            {title}
          </h1>
          {lede ? (
            <p className="max-w-2xl text-body-lg text-text-secondary">{lede}</p>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap gap-3">{actions}</div>
          ) : null}
          {children}
        </div>
        {media?.type === "image" && media.src ? (
          <FgImage
            src={media.src}
            alt={media.alt}
            priority
            rounded="sm"
            sizes="(min-width: 1024px) 45vw, 100vw"
            // A fixed 4:5 frame with the photo contained, never cropped:
            // the frame is reserved up front so nothing jumps on load.
            className="aspect-[4/5] w-full max-lg:aspect-[4/3]"
            imageClassName="object-contain"
          />
        ) : null}
        {media?.type === "contact" ? (
          <div className="flex min-w-0 flex-col gap-3">
            {media.edge ? (
              <p className="flex justify-between font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
                <span>{media.edge[0]}</span>
                <span>{media.edge[1]}</span>
              </p>
            ) : null}
            <ol className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
              {media.frames.map((item, index) => {
                const picked = media.picked === index;
                return (
                  <li
                    key={item.label}
                    className="flex w-32 shrink-0 snap-start flex-col gap-1.5 md:w-auto"
                  >
                    <span
                      className={cn(
                        "block rounded-[var(--fg-radius-sm)] p-0.5",
                        picked && "ring-2 ring-gold-400",
                      )}
                    >
                      <FgImage
                        src={item.src}
                        alt={item.alt ?? ""}
                        ratio="4/5"
                        revealIndex={index}
                        sizes="(min-width: 768px) 16vw, 128px"
                      />
                    </span>
                    <span className="flex justify-between gap-2 font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
                      {item.meta ? (
                        <span className="truncate">{item.meta}</span>
                      ) : null}
                      {picked ? <span className="text-gold-400">●</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
