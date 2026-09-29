import Link from "next/link";

import { FgImage } from "@/components/ui/fg-image";

interface AlbumCardProps {
  href: string;
  title: string;
  description?: string | null;
  coverUrl: string | null;
  /** Already-formatted "48 ảnh". */
  countLabel: string;
  /** "Minh Anh Nhiếp Ảnh · Cưới". */
  byline?: string | null;
  revealIndex?: number;
}

// One project album: the cover with its photo count on the scrim, the
// title (two lines at most), who shot it, and a two-line description.
// Used by the /browse "Album dự án" tab and the profile's album strip.
export function AlbumCard({
  href,
  title,
  description,
  coverUrl,
  countLabel,
  byline,
  revealIndex,
}: AlbumCardProps) {
  return (
    <Link
      href={href}
      className="group/album focus-ring flex flex-col gap-2.5 rounded-[var(--fg-radius-sm)]"
    >
      <FgImage
        src={coverUrl}
        alt=""
        ratio="4/3"
        revealIndex={revealIndex}
        sizes="(min-width: 1280px) 22vw, (min-width: 640px) 33vw, 50vw"
        className="transition-[transform,box-shadow] duration-[var(--fg-dur-260)] ease-fg-out group-hover/album:-translate-y-0.5 group-hover/album:shadow-[var(--shadow-md)] motion-reduce:group-hover/album:translate-y-0"
        imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/album:scale-[1.03]"
      >
        <span className="absolute bottom-2 left-2 rounded-[4px] bg-scrim px-1.5 py-0.5 font-mono text-meta text-gold-50">
          {countLabel}
        </span>
      </FgImage>
      <span className="line-clamp-2 text-heading-sm text-text-primary">
        {title}
      </span>
      {byline ? (
        <span className="-mt-1.5 truncate text-meta text-text-tertiary">
          {byline}
        </span>
      ) : null}
      {description ? (
        <span className="line-clamp-2 text-body-sm text-text-secondary">
          {description}
        </span>
      ) : null}
    </Link>
  );
}
