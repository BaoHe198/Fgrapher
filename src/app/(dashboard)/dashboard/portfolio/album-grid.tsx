"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImageOff, Plus, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { AlbumFormDialog } from "./album-form-dialog";
import { TrashSheet } from "./trash-sheet";
import { UploadMediaModal } from "@/components/modals/upload-media-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { buildMediaVariants } from "@/lib/media-variants";
import { cn } from "@/lib/utils";

export interface AlbumCard {
  id: string;
  title: string;
  category: ProfileCategory | null;
  shootDate: string | null;
  coverMedia: { id: string; url: string; type: string } | null;
  mediaCount: number;
}

function SortableAlbumCard({
  album,
  onDelete,
  t,
  categoryT,
}: {
  album: AlbumCard;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
  categoryT: ReturnType<typeof useTranslations>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-50")}
    >
      <Card padding={false} className="flex flex-col gap-0 overflow-hidden">
        <Link
          href={`/dashboard/portfolio/${album.id}`}
          className="relative block aspect-4/3 bg-bg-sunken"
        >
          {album.coverMedia ? (
            album.coverMedia.type === "VIDEO" ? (
              <video
                src={album.coverMedia.url}
                className="size-full object-cover"
                muted
              />
            ) : (
              <Image
                src={buildMediaVariants(album.coverMedia.url).thumbnail}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            )
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-8 text-text-tertiary" />
            </div>
          )}
        </Link>
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <Link
              href={`/dashboard/portfolio/${album.id}`}
              className="truncate text-body-md font-semibold! text-text-primary hover:underline"
            >
              {album.title}
            </Link>
            <p className="text-body-sm text-text-tertiary">
              {album.category ? categoryT(album.category) : t("uncategorized")}
              {" · "}
              {t("photoCount", { count: album.mediaCount })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="flex size-7 cursor-grab items-center justify-center rounded-full text-text-tertiary hover:bg-bg-sunken"
              aria-label={t("reorder")}
            >
              <GripVertical className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(album.id)}
              className="flex size-7 items-center justify-center rounded-full text-text-tertiary hover:bg-danger-bg hover:text-danger"
              aria-label={t("deleteAlbum")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AlbumGrid({
  profileId,
  role,
  initialAlbums,
}: {
  profileId: string;
  role: Role;
  initialAlbums: AlbumCard[];
}) {
  const t = useTranslations("dashboardCore.albums");
  const categoryT = useTranslations("profileCategory");
  const [albums, setAlbums] = useState(initialAlbums);
  const [formOpen, setFormOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDelete = async (id: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
    const body = await res.json();
    toast.add({
      title: res.ok
        ? t("deletedToast")
        : (body.message ?? t("deleteFailedToast")),
      type: res.ok ? "success" : "error",
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = albums.findIndex((a) => a.id === active.id);
    const newIndex = albums.findIndex((a) => a.id === over.id);
    const next = arrayMove(albums, oldIndex, newIndex);
    setAlbums(next);

    await fetch(`/api/albums/reorder?profileId=${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((a) => a.id) }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm text-text-secondary">
          {t("albumCount", { count: albums.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setTrashOpen(true)}>
            {t("trashButton")}
          </Button>
          <Button variant="accent" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            {t("newAlbum")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="size-4" />
            {t("uploadPhotos")}
          </Button>
        </div>
      </div>

      {albums.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ImageOff className="size-10 text-text-tertiary" />
          <p className="text-body-md font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-sm text-text-secondary">{t("empty.body")}</p>
          <Button variant="accent" size="sm" onClick={() => setFormOpen(true)}>
            {t("newAlbum")}
          </Button>
        </Card>
      ) : (
        <DndContext
          id="albums"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={albums.map((a) => a.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {albums.map((album) => (
                <SortableAlbumCard
                  key={album.id}
                  album={album}
                  onDelete={onDelete}
                  t={t}
                  categoryT={categoryT}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlbumFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        profileId={profileId}
        role={role}
        onCreated={(album) =>
          setAlbums((prev) => [
            ...prev,
            {
              id: album.id,
              title: album.title,
              category: album.category,
              shootDate: album.shootDate,
              coverMedia: null,
              mediaCount: 0,
            },
          ])
        }
      />

      <TrashSheet
        open={trashOpen}
        onOpenChange={setTrashOpen}
        profileId={profileId}
        onRestored={() => window.location.reload()}
      />

      <UploadMediaModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        profileId={profileId}
        role={role}
        onUploaded={() => window.location.reload()}
      />
    </div>
  );
}
