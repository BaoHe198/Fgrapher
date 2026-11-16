import Image from "next/image";

import {
  ROLE_PHOTOS,
  STYLE_PHOTOS,
  type ShowcasePhoto,
} from "@/lib/constants/showcase-images";
import { cn } from "@/lib/utils";

// The home hero's moving wall of photographs (owner, 16/11/2026: the home
// page should open on pictures, not on a filter bar). Fixed showcase
// artwork only - never provider uploads - for the same reason the role
// tiles use it. Each strip holds its photos twice and drifts by exactly
// half its length, so the loop has no seam. Decorative: hidden from
// assistive tech, and it stands still under reduced motion.
const COLUMNS: ShowcasePhoto[][] = [
  [
    STYLE_PHOTOS.WEDDING[1],
    STYLE_PHOTOS.FASHION[0],
    ROLE_PHOTOS.PHOTOGRAPHER[1],
    STYLE_PHOTOS.YEARBOOK[1],
  ],
  [
    STYLE_PHOTOS.PORTRAIT[2],
    ROLE_PHOTOS.COSTUME_SHOP[0],
    ROLE_PHOTOS.MAKEUP_ARTIST[0],
    STYLE_PHOTOS.FASHION[1],
  ],
  [
    STYLE_PHOTOS.FASHION[2],
    STYLE_PHOTOS.WEDDING[2],
    ROLE_PHOTOS.MODEL[0],
    ROLE_PHOTOS.VIDEOGRAPHER[0],
  ],
];

function Frame({
  photo,
  eager,
  className,
}: {
  photo: ShowcasePhoto;
  eager: boolean;
  className: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[3/4] shrink-0 overflow-hidden rounded-[var(--fg-radius-md)] bg-green-800",
        className,
      )}
    >
      <Image
        src={photo.src}
        alt=""
        fill
        sizes="(min-width: 1024px) 180px, 120px"
        loading={eager ? "eager" : "lazy"}
        className="object-cover"
      />
    </div>
  );
}

/** Desktop: three columns drifting in alternating directions. */
export function HeroCollage({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative grid h-full grid-cols-3 gap-3 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]",
        className,
      )}
    >
      {COLUMNS.map((column, index) => (
        <div
          key={index}
          className={cn(
            "flex flex-col gap-3",
            index === 1 ? "animate-drift-down" : "animate-drift-up",
          )}
        >
          {[...column, ...column].map((photo, slot) => (
            <Frame
              key={`${photo.src}-${slot}`}
              photo={photo}
              eager={slot < 2}
              className="w-full"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Phones: one strip drifting sideways. */
export function HeroStrip({ className }: { className?: string }) {
  const photos = [
    COLUMNS[0][0],
    COLUMNS[1][0],
    COLUMNS[2][0],
    COLUMNS[0][1],
    COLUMNS[2][1],
    COLUMNS[1][2],
  ];
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className,
      )}
    >
      <div className="flex h-40 w-max animate-drift-left gap-2.5">
        {[...photos, ...photos].map((photo, slot) => (
          <Frame
            key={`${photo.src}-${slot}`}
            photo={photo}
            eager={slot < 4}
            className="h-full"
          />
        ))}
      </div>
    </div>
  );
}
