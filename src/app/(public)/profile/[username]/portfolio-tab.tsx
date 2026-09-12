"use client";

import type { MediaType, ProfileCategory, Role } from "@prisma/client";
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
import { GripVertical, ImageOff, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { buildMediaVariants } from "@/lib/media-variants";
import { cn } from "@/lib/utils";

import { AlbumEditDialog } from "./album-edit-dialog";
import { AlbumFormDialog } from "@/app/(dashboard)/dashboard/portfolio/album-form-dialog";

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
  // Used to lay the mosaic out at each photo's real aspect ratio. A
  // photographer framed the shot; cropping it to a uniform tile throws
  // away the composition they are being hired for. Nullable because rows
  // predating the width/height columns exist.
  width: number | null;
  height: number | null;
}

interface AlbumItem {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  coverMedia: { id: string; url: string; type: MediaType } | null;
  media: MediaItem[];
}

interface OwnerAlbum {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  coverMedia: { id: string; url: string; type: MediaType } | null;
  mediaCount: number;
  isPublished: boolean;
}

function AlbumTile({
  album,
  photoCountLabel,
  isDraft,
  editable,
  onOpen,
  onEdit,
  t,
}: {
  album: { id: string; title: string; coverMedia: OwnerAlbum["coverMedia"] };
  photoCountLabel: string;
  isDraft: boolean;
  editable: boolean;
  onOpen: () => void;
  onEdit: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.id, disabled: !editable });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex h-[200px] flex-col justify-end overflow-hidden rounded-xl bg-bg-sunken text-left",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 size-full cursor-pointer"
        aria-label={album.title}
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
              src={buildMediaVariants(album.coverMedia.url).thumbnail}
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
      </button>

      <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <p className="truncate text-body-sm font-semibold! text-white">
          {album.title}
        </p>
        <div className="flex items-center gap-1.5 text-body-sm text-white/80">
          <span>{photoCountLabel}</span>
          {isDraft ? (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-caption-upper">
              {t("draftBadge")}
            </span>
          ) : null}
        </div>
      </div>

      {editable ? (
        <>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("reorderAria")}
            className="absolute top-2 left-2 z-10 flex size-7 cursor-grab items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("editAlbumAria")}
            className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function AlbumChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-body-sm whitespace-nowrap transition-colors",
        active
          ? "border-brand-primary bg-brand-primary text-text-on-brand"
          : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
      )}
    >
      {label}
    </button>
  );
}

interface PortfolioTabProps {
  albums: AlbumItem[];
  // Only present (non-null) when isOwnProfile — see profile-interactive.tsx.
  ownerAlbums: OwnerAlbum[] | null;
  profileId: string;
  role: Role;
  isOwnProfile: boolean;
  // Gates only the "+ new album" tile — POST /api/albums is the one album
  // action that actually requires an active subscription server-side;
  // reordering/editing existing albums doesn't, so those stay available
  // to the owner regardless (see page.tsx's comment on canEditPortfolio).
  canEdit: boolean;
}

export function PortfolioTab({
  albums,
  ownerAlbums,
  profileId,
  role,
  isOwnProfile,
  canEdit,
}: PortfolioTabProps) {
  const t = useTranslations("publicPages.profile.portfolioTab");
  const categoryT = useTranslations("profileCategory");
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Visitor-side album filter. null = every photo, which is the default:
  // most visitors want to see the work, not pick a folder first.
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  // Index into visiblePhotos; null = closed. Separate from openAlbumId,
  // which drives the owner grid's per-album preview.
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [localOwnerAlbums, setLocalOwnerAlbums] = useState(ownerAlbums ?? []);
  const [editingAlbum, setEditingAlbum] = useState<OwnerAlbum | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const showOwnerGrid = isOwnProfile && ownerAlbums !== null;

  if (!showOwnerGrid && albums.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  const openAlbum = albums.find((a) => a.id === openAlbumId) ?? null;

  // Every approved photo, flattened across albums, each carrying the album
  // it came from so the lightbox can still show that context.
  const allPhotos = albums.flatMap((album) =>
    album.media.map((media) => ({ ...media, album })),
  );
  const visiblePhotos =
    activeAlbumId === null
      ? allPhotos
      : allPhotos.filter((photo) => photo.album.id === activeAlbumId);
  const openPhoto =
    photoIndex === null ? null : (visiblePhotos[photoIndex] ?? null);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOwnerAlbums.findIndex((a) => a.id === active.id);
    const newIndex = localOwnerAlbums.findIndex((a) => a.id === over.id);
    const next = arrayMove(localOwnerAlbums, oldIndex, newIndex);
    setLocalOwnerAlbums(next);

    await fetch(`/api/albums/reorder?profileId=${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((a) => a.id) }),
    });
  };

  const onTileOpen = (album: OwnerAlbum) => {
    // A tile whose album is also in the public (moderated/published) list
    // has full media to preview via the same lightbox visitors see;
    // otherwise (a draft, or nothing approved yet) there's nothing to
    // preview, so open the edit dialog instead.
    const publicMatch = albums.find((a) => a.id === album.id);
    if (publicMatch) {
      setOpenAlbumId(publicMatch.id);
      setLightboxIndex(0);
    } else {
      setEditingAlbum(album);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {showOwnerGrid ? (
        <DndContext
          id="profile-albums"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={localOwnerAlbums.map((a) => a.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {localOwnerAlbums.map((album) => (
                <AlbumTile
                  key={album.id}
                  album={album}
                  photoCountLabel={t("photoCount", {
                    count: album.mediaCount,
                  })}
                  // Not visible to a visitor yet — either unpublished or
                  // (far more commonly, since Album.isPublished defaults
                  // true) has no APPROVED photo yet. Cross-referencing
                  // the already-fetched public `albums` list is the only
                  // way to know this without per-photo moderation data.
                  isDraft={!albums.some((a) => a.id === album.id)}
                  editable
                  onOpen={() => onTileOpen(album)}
                  onEdit={() => setEditingAlbum(album)}
                  t={t}
                />
              ))}

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="flex h-[200px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-default text-text-tertiary hover:border-border-strong hover:text-text-secondary"
                >
                  <Plus className="size-6" />
                  <span className="text-body-sm font-semibold!">
                    {t("newAlbumTile")}
                  </span>
                </button>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          {/* Album chips only earn their space once there is more than one
              body of work to switch between. */}
          {albums.length > 1 ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <AlbumChip
                label={t("allAlbums")}
                active={activeAlbumId === null}
                onClick={() => setActiveAlbumId(null)}
              />
              {albums.map((album) => (
                <AlbumChip
                  key={album.id}
                  label={album.title}
                  active={activeAlbumId === album.id}
                  onClick={() => setActiveAlbumId(album.id)}
                />
              ))}
            </div>
          ) : null}

          {/* CSS columns, not a grid: every photo keeps its own aspect
              ratio, so a portrait stays a portrait and nothing is cropped
              to fit a tile. Two columns on a phone — one photo per screen
              is not a portfolio, it is a slideshow. */}
          <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
            {visiblePhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setPhotoIndex(index)}
                aria-label={photo.title ?? t("photoAria")}
                className="block w-full cursor-pointer overflow-hidden rounded-xl bg-bg-sunken break-inside-avoid focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
              >
                {photo.type === "VIDEO" ? (
                  <video src={photo.url} className="w-full" muted playsInline />
                ) : (
                  <Image
                    src={buildMediaVariants(photo.url).medium}
                    alt={photo.title ?? ""}
                    width={photo.width ?? 800}
                    height={photo.height ?? 1000}
                    className="h-auto w-full"
                    sizes="(min-width: 640px) 30vw, 45vw"
                    unoptimized
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {isOwnProfile && !canEdit ? (
        <p className="text-body-sm text-text-tertiary">{t("upgradeHint")}</p>
      ) : null}

      {openPhoto ? (
        <MediaLightbox
          items={visiblePhotos}
          index={photoIndex ?? 0}
          onClose={() => setPhotoIndex(null)}
          onIndexChange={setPhotoIndex}
          title={openPhoto.album.title}
          description={openPhoto.album.description}
          categoryLabel={
            openPhoto.album.category
              ? categoryT(openPhoto.album.category)
              : undefined
          }
        />
      ) : null}

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

      <AlbumEditDialog
        open={editingAlbum !== null}
        onOpenChange={(open) => {
          if (!open) setEditingAlbum(null);
        }}
        role={role}
        album={editingAlbum}
        onSaved={(saved) => {
          setLocalOwnerAlbums((prev) =>
            prev.map((a) =>
              a.id === saved.id
                ? {
                    ...a,
                    title: saved.title,
                    description: saved.description,
                    category: saved.category,
                  }
                : a,
            ),
          );
          setEditingAlbum(null);
        }}
      />

      <AlbumFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        profileId={profileId}
        role={role}
        onCreated={(created) =>
          setLocalOwnerAlbums((prev) => [
            ...prev,
            {
              id: created.id,
              title: created.title,
              // AlbumFormDialog's onCreated only types back id/title/
              // category/shootDate even though the row it created may
              // have a description — a reload picks up the real value;
              // this local placeholder just avoids a stale edit dialog
              // showing undefined before that.
              description: null,
              category: created.category,
              coverMedia: null,
              mediaCount: 0,
              // Album.isPublished defaults to true — a fresh album is
              // simply invisible on the public page until it has an
              // APPROVED photo (getPublicProfileUser's filter), not
              // because it's unpublished.
              isPublished: true,
            },
          ])
        }
      />
    </div>
  );
}
