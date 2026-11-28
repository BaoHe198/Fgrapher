"use client";

import { MessageCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CloudinaryImage } from "@/components/ui/cloudinary-image";

interface GroupPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  albumTitle: string | null;
}

interface MoodboardGroupProps {
  artistId: string;
  /** The viewer pinned their own photos: nobody to message. */
  isSelf: boolean;
  name: string;
  roleLabel: string;
  profileHref: string | null;
  photos: GroupPhoto[];
}

/** Album names for the drafted message, kept short enough for a URL. */
function albumList(photos: GroupPhoto[]) {
  const titles = Array.from(
    new Set(
      photos
        .map((photo) => photo.albumTitle?.trim())
        .filter((title): title is string => Boolean(title)),
    ),
  );
  return titles
    .slice(0, 4)
    .map((title) => `“${title.slice(0, 60)}”`)
    .join(", ");
}

export function MoodboardGroup({
  artistId,
  isSelf,
  name,
  roleLabel,
  profileHref,
  photos,
}: MoodboardGroupProps) {
  const t = useTranslations("dashboardCore.moodboard");
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  const remove = async (id: string) => {
    setRemoving(id);
    const res = await fetch("/api/moodboard", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: id }),
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
    } else {
      toast.add({ title: t("removeFailed"), type: "error" });
    }
    setRemoving(null);
  };

  const messageParams = new URLSearchParams({
    to: artistId,
    board: String(photos.length),
  });
  const albums = albumList(photos);
  if (albums) messageParams.set("boardAlbums", albums);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-heading-lg text-text-primary">
            {profileHref ? (
              <Link href={profileHref} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </h2>
          <span className="text-body-sm text-text-secondary">
            {roleLabel} · {t("photoCount", { count: photos.length })}
          </span>
        </div>
        {isSelf ? null : (
          <Button
            variant="accent"
            nativeButton={false}
            render={<Link href={`/dashboard/messages?${messageParams}`} />}
          >
            <MessageCircle className="size-4" />
            {t("sendBrief")}
          </Button>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <li
            key={photo.id}
            className="group/pin relative overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken"
          >
            <div className="relative aspect-[4/5]">
              <CloudinaryImage
                src={photo.url}
                alt={photo.albumTitle ?? name}
                fill
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
                className="object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(photo.id)}
              disabled={removing === photo.id}
              aria-label={t("remove")}
              title={t("remove")}
              className="focus-ring absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-opacity duration-[var(--fg-dur-150)] hover:bg-black/80 disabled:opacity-50 md:opacity-0 md:group-hover/pin:opacity-100 md:focus-visible:opacity-100"
            >
              <X aria-hidden className="size-4" />
            </button>
            {photo.albumTitle ? (
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-body-sm text-white">
                {photo.albumTitle}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
