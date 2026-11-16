"use client";

import type { ProfileCategory } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { MediaKind } from "@/lib/media/kind";
import { cn } from "@/lib/utils";

interface QuickViewAlbum {
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  artist: { name: string; href: string; bookingHref: string | null };
  photos: { id: string; url: string; type: MediaKind; title: string | null }[];
}

interface AlbumQuickViewProps {
  albumId: string;
  /** Without a username there is no public album to open: a plain link. */
  username: string | null;
  children: React.ReactNode;
  className?: string;
}

// Pressing an album opens its photos in the lightbox, in place (owner,
// 16/11/2026), with the way on to the artist's profile. The link inside
// stays a real link to the album page: a modified click (new tab) still
// goes there, and so does a plain click if the photos cannot be loaded.
export function AlbumQuickView({
  albumId,
  username,
  children,
  className,
}: AlbumQuickViewProps) {
  const t = useTranslations("publicPages.album.quickView");
  const categoryT = useTranslations("profileCategory");
  const router = useRouter();
  const [album, setAlbum] = useState<QuickViewAlbum | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const loaded = useRef<QuickViewAlbum | null>(null);

  const onClickCapture = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !username ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as HTMLElement).closest("a");
    if (!link || !event.currentTarget.contains(link)) return;
    event.preventDefault();
    if (loading) return;

    if (loaded.current) {
      setAlbum(loaded.current);
      setIndex(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/albums/${encodeURIComponent(albumId)}/public?username=${encodeURIComponent(username)}`,
      );
      const body = (await res.json().catch(() => null)) as {
        data: QuickViewAlbum | null;
      } | null;
      if (!res.ok || !body?.data || body.data.photos.length === 0) {
        throw new Error("load_failed");
      }
      loaded.current = body.data;
      setAlbum(body.data);
      setIndex(0);
    } catch {
      // Fall back to the album page rather than doing nothing.
      toast.add({ title: t("loadFailed"), type: "error" });
      router.push(link.getAttribute("href") ?? `/profile/${username}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn("relative", className)}
      onClickCapture={onClickCapture}
      aria-busy={loading || undefined}
    >
      {children}
      {loading ? (
        <span
          role="status"
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-[var(--fg-radius-sm)] bg-bg-page/40"
        >
          <Loader2 className="size-6 animate-spin text-text-primary" />
          <span className="sr-only">{t("loading")}</span>
        </span>
      ) : null}
      {album && index !== null ? (
        <MediaLightbox
          items={album.photos.map((photo) => ({
            url: photo.url,
            title: photo.title,
            type: photo.type,
          }))}
          index={index}
          onClose={() => setIndex(null)}
          onIndexChange={setIndex}
          title={album.title}
          description={album.description}
          categoryLabel={album.category ? categoryT(album.category) : undefined}
          actions={
            <AlbumLightboxActions
              profileHref={album.artist.href}
              profileLabel={t("viewProfile", { name: album.artist.name })}
              bookingHref={album.artist.bookingHref}
              bookingLabel={t("book")}
            />
          }
        />
      ) : null}
    </div>
  );
}

interface AlbumLightboxActionsProps {
  profileHref: string | null;
  profileLabel: string;
  bookingHref?: string | null;
  bookingLabel?: string;
}

// The way on from an album's photos: the artist's profile, and booking when
// the artist takes bookings. Also used by Cộng đồng F's album posts.
export function AlbumLightboxActions({
  profileHref,
  profileLabel,
  bookingHref,
  bookingLabel,
}: AlbumLightboxActionsProps) {
  return (
    <>
      {profileHref ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={profileHref} />}
        >
          {profileLabel}
        </Button>
      ) : null}
      {bookingHref && bookingLabel ? (
        <Button
          variant="accent"
          size="sm"
          nativeButton={false}
          render={<Link href={bookingHref} />}
        >
          {bookingLabel}
        </Button>
      ) : null}
    </>
  );
}
