"use client";

import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { startTransition, useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { buildMediaVariants } from "@/lib/media-variants";

interface TrashedAlbum {
  id: string;
  title: string;
  deletedAt: string;
}

interface TrashedMedia {
  id: string;
  url: string;
  type: string;
  deletedAt: string;
}

interface TrashSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onRestored: () => void;
}

const TRASH_TTL_DAYS = 7;

function daysRemaining(deletedAt: string) {
  const deletedTime = new Date(deletedAt).getTime();
  const purgeTime = deletedTime + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purgeTime - Date.now()) / 86_400_000));
}

// Prompt G3 — the trash the project owner asked for (7-day recoverable
// delete, not delete-vs-move-at-delete-time): shows both whole trashed
// albums and any individually-trashed photo not already covered by one.
export function TrashSheet({
  open,
  onOpenChange,
  profileId,
  onRestored,
}: TrashSheetProps) {
  const t = useTranslations("dashboardCore.albums.trash");
  const [albums, setAlbums] = useState<TrashedAlbum[]>([]);
  const [media, setMedia] = useState<TrashedMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    startTransition(() => setIsLoading(true));
    fetch(`/api/albums/trash?profileId=${profileId}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setAlbums(body.data?.albums ?? []);
          setMedia(body.data?.media ?? []);
          setIsLoading(false);
        });
      });
  }, [open, profileId]);

  const restoreAlbum = async (id: string) => {
    setRestoringId(id);
    const res = await fetch(`/api/albums/${id}/restore`, { method: "PATCH" });
    setRestoringId(null);
    if (res.ok) {
      setAlbums((prev) => prev.filter((a) => a.id !== id));
      toast.add({ title: t("restoredToast"), type: "success" });
      onRestored();
    }
  };

  const restoreMedia = async (id: string) => {
    setRestoringId(id);
    const res = await fetch(`/api/portfolio/${id}/restore`, {
      method: "PATCH",
    });
    setRestoringId(null);
    if (res.ok) {
      setMedia((prev) => prev.filter((m) => m.id !== id));
      toast.add({ title: t("restoredToast"), type: "success" });
      onRestored();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-text-tertiary" />
            </div>
          ) : albums.length === 0 && media.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Trash2 className="size-8 text-text-tertiary" />
              <p className="text-body-sm text-text-secondary">{t("empty")}</p>
            </div>
          ) : (
            <>
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold! text-text-primary">
                      {album.title}
                    </p>
                    <p className="text-body-sm text-text-tertiary">
                      {t("daysLeft", { count: daysRemaining(album.deletedAt) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreAlbum(album.id)}
                    disabled={restoringId === album.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-body-sm font-semibold! text-text-primary"
                  >
                    {restoringId === album.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    {t("restore")}
                  </button>
                </div>
              ))}
              {media.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken">
                      {item.type === "IMAGE" ? (
                        <Image
                          src={buildMediaVariants(item.url).thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <p className="text-body-sm text-text-tertiary">
                      {t("daysLeft", { count: daysRemaining(item.deletedAt) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreMedia(item.id)}
                    disabled={restoringId === item.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-body-sm font-semibold! text-text-primary"
                  >
                    {restoringId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    {t("restore")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
