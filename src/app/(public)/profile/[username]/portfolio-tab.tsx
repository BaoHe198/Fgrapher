"use client";

import type { MediaType, ProfileCategory } from "@prisma/client";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
}

interface AlbumItem {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  coverMedia: { id: string; url: string; type: MediaType } | null;
  media: MediaItem[];
}

export function PortfolioTab({ albums }: { albums: AlbumItem[] }) {
  const t = useTranslations("publicPages.profile.portfolioTab");
  const categoryT = useTranslations("profileCategory");
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (albums.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  const openAlbum = albums.find((a) => a.id === openAlbumId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            onClick={() => {
              setOpenAlbumId(album.id);
              setLightboxIndex(0);
            }}
            className="group relative flex h-[200px] cursor-pointer flex-col justify-end overflow-hidden rounded-xl bg-bg-sunken text-left"
          >
            {album.coverMedia ? (
              album.coverMedia.type === "VIDEO" ? (
                <video
                  src={album.coverMedia.url}
                  className="absolute inset-0 size-full object-cover"
                  muted
                />
              ) : (
                <Image
                  src={album.coverMedia.url}
                  alt={album.title}
                  fill
                  className="object-cover transition-transform duration-150 group-hover:scale-105"
                  unoptimized
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageOff className="size-8 text-text-tertiary" />
              </div>
            )}
            <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
              <p className="truncate text-body-sm font-semibold! text-white">
                {album.title}
              </p>
              <p className="text-body-sm text-white/80">
                {t("photoCount", { count: album.media.length })}
              </p>
            </div>
          </button>
        ))}
      </div>

      {openAlbum ? (
        <MediaLightbox
          items={openAlbum.media}
          index={lightboxIndex}
          onClose={() => setOpenAlbumId(null)}
          onIndexChange={setLightboxIndex}
          title={openAlbum.title}
          description={openAlbum.description}
          categoryLabel={
            openAlbum.category ? categoryT(openAlbum.category) : undefined
          }
        />
      ) : null}
    </div>
  );
}
