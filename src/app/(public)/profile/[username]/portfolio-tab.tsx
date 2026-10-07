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
import { GripVertical, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";

import { FrameMark } from "@/components/brand/frame-mark";
import { MasonryGrid } from "@/components/ui/masonry-grid";
import { MediaLightbox } from "@/components/modals/media-lightbox";
import { PostEngagement } from "@/components/social/post-engagement";
import { buildMediaVariants } from "@/lib/media/variants";
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
  socialPost: {
    id: string;
    likeCount: number;
    commentCount: number;
    likedByViewer: boolean;
  } | null;
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
            <FrameMark size={34} className="text-text-tertiary" />
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
  /** For the album pages' URLs. */
  username: string;
  albums: AlbumItem[];
  // Only present (non-null) when isOwnProfile — see profile-interactive.tsx.
  ownerAlbums: OwnerAlbum[] | null;
  profileId: string;
  role: Role;
  viewerId: string | null;
  isOwnProfile: boolean;
  // Gates only the "+ new album" tile — POST /api/albums is the one album
  // action that actually requires an active subscription server-side;
  // reordering/editing existing albums doesn't, so those stay available
  // to the owner regardless (see page.tsx's comment on canEditPortfolio).
  canEdit: boolean;
  /** Decides where "renew" leads — see the hint at the bottom. */
  billingEnabled: boolean;
}

export function PortfolioTab({
  username,
  albums,
  ownerAlbums,
  profileId,
  role,
  viewerId,
  isOwnProfile,
  canEdit,
  billingEnabled,
}: PortfolioTabProps) {
  const t = useTranslations("publicPages.profile.portfolioTab");
  const categoryT = useTranslations("profileCategory");
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Visitor-side style filter. null = every photo, which is the default:
  // most visitors want to see the work, not pick a folder first.
  const [activeCategory, setActiveCategory] = useState<ProfileCategory | null>(
    null,
  );
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

  // /browse's "Album dự án" tab links to /profile/<name>?album=<id>#albums.
  // Read once on mount (a Client Component can't take searchParams here
  // without making the whole page dynamic on it).
  // Older links (/browse's album tab, ⌘K) carry ?album=<id>: send them
  // to the album's own page.
  const router = useRouter();
  useEffect(() => {
    const albumId = new URLSearchParams(window.location.search).get("album");
    if (albumId && albums.some((album) => album.id === albumId)) {
      router.replace(`/profile/${username}/albums/${albumId}`);
    }
  }, [albums, router, username]);
  const gridRef = useRef<HTMLDivElement>(null);
  const originFor = useCallback(
    (index: number) =>
      gridRef.current?.querySelector<HTMLElement>(
        `[data-frame-index="${index}"]`,
      ) ?? null,
    [],
  );

  if (!showOwnerGrid && albums.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FrameMark size={44} className="text-text-tertiary" />
        <p className="text-body-md text-text-secondary">{t("empty")}</p>
      </div>
    );
  }

  const openAlbum = albums.find((a) => a.id === openAlbumId) ?? null;

  // Every approved photo, flattened across albums, each carrying the album
  // it came from so the lightbox can still show that context.
  const allPhotos = albums.flatMap((album) =>
    album.media.map((media) => ({ ...media, album })),
  );
  const photoCategories = [
    ...new Set(
      albums
        .map((album) => album.category)
        .filter((category): category is ProfileCategory => category !== null),
    ),
  ];
  const visiblePhotos =
    activeCategory === null
      ? allPhotos
      : allPhotos.filter((photo) => photo.album.category === activeCategory);
  // The grid shows photos; videos stay reachable inside their album.
  const visibleImages = visiblePhotos.filter((photo) => photo.type === "IMAGE");
  const openPhoto =
    photoIndex === null ? null : (visibleImages[photoIndex] ?? null);

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
          {/* Albums as projects (wave 2): big covers - the first across
              the full width at 21:9, the rest 3:2 - each opening the
              album's own photo-essay page, the cover flying there. The
              cover is cropped here; the essay never crops. */}
          <section className="flex flex-col gap-4">
            <h3 className="text-heading-lg text-text-primary">
              {t("albumsHeading")}
            </h3>
            <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2">
              {albums.map((album, index) => {
                const cover = album.coverMedia ?? album.media[0] ?? null;
                const wide = index === 0;
                return (
                  <li
                    key={album.id}
                    id={`album-${album.id}`}
                    className={cn(
                      "flex flex-col gap-2.5",
                      wide && "sm:col-span-2",
                    )}
                  >
                    <Link
                      href={`/profile/${username}/albums/${album.id}`}
                      className="group/album focus-ring flex flex-col gap-2.5 rounded-[var(--fg-radius-sm)]"
                    >
                      <span
                        className={cn(
                          "relative block overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken",
                          wide
                            ? "aspect-[3/2] sm:aspect-[21/9]"
                            : "aspect-[3/2]",
                        )}
                      >
                        {cover && cover.type === "IMAGE" ? (
                          <ViewTransition
                            name={`album-${album.id}`}
                            share="morph"
                            default="none"
                          >
                            <Image
                              src={buildMediaVariants(cover.url).medium}
                              alt=""
                              fill
                              unoptimized
                              sizes={
                                wide
                                  ? "(min-width: 1024px) 66vw, 100vw"
                                  : "(min-width: 640px) 33vw, 100vw"
                              }
                              className="object-cover transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/album:scale-[1.02] motion-reduce:transition-none"
                            />
                          </ViewTransition>
                        ) : (
                          <span className="absolute inset-0 grid place-items-center">
                            <FrameMark
                              size={34}
                              className="text-text-tertiary"
                            />
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
                        {t("albumFrame", { count: album.media.length })}
                      </span>
                      <span className="text-heading-md text-text-primary group-hover/album:underline group-hover/album:underline-offset-4">
                        {album.title}
                      </span>
                      {album.category || album.description ? (
                        <span className="line-clamp-2 text-body-sm text-text-secondary">
                          {[
                            album.category ? categoryT(album.category) : null,
                            album.description,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </Link>
                    {album.socialPost ? (
                      <PostEngagement
                        postId={album.socialPost.id}
                        viewerId={viewerId}
                        initialLiked={album.socialPost.likedByViewer}
                        initialLikeCount={album.socialPost.likeCount}
                        initialCommentCount={album.socialPost.commentCount}
                        postOwnerId={
                          isOwnProfile ? (viewerId ?? undefined) : undefined
                        }
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-10 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-baseline gap-2 text-heading-md text-text-primary">
                {t("allPhotos")}
                <span className="font-mono text-meta tabular-nums text-text-tertiary">
                  {t("photoCount", { count: allPhotos.length })}
                </span>
              </h3>
              {/* Styles, not folder names: "Cưới / Kỷ yếu" is how a
                  customer thinks; the album titles are the covers above. */}
              {photoCategories.length > 1 ? (
                <div
                  role="group"
                  aria-label={t("filterByStyle")}
                  className="flex flex-wrap gap-2"
                >
                  <AlbumChip
                    label={t("allAlbums")}
                    active={activeCategory === null}
                    onClick={() => setActiveCategory(null)}
                  />
                  {photoCategories.map((category) => (
                    <AlbumChip
                      key={category}
                      label={categoryT(category)}
                      active={activeCategory === category}
                      onClick={() => setActiveCategory(category)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {/* Every photo at its own ratio (MasonryGrid never crops), or
                the contact sheet; the choice is remembered per viewer. */}
            <div ref={gridRef}>
              <MasonryGrid
                items={visiblePhotos
                  .filter((photo) => photo.type === "IMAGE")
                  .map((photo) => ({
                    id: photo.id,
                    src: buildMediaVariants(photo.url).medium,
                    width: photo.width,
                    height: photo.height,
                    alt: photo.title ?? photo.album.title,
                  }))}
                showModeSwitch
                storageKey="fg:profile-photo-mode"
                onOpen={setPhotoIndex}
              />
            </div>
          </section>
        </>
      )}

      {/* "Renew your plan to create new albums" gave no way to renew —
          and with billing off (the MVP state) the billing page says
          Fgrapher is free, which contradicts it outright. It now says what
          happened and links to the one place that can act: the billing
          page when billing is on, support when it isn't. */}
      {isOwnProfile && !canEdit ? (
        <p className="text-body-sm text-text-tertiary">
          {t.rich(
            billingEnabled ? "upgradeHintBilling" : "upgradeHintSupport",
            {
              link: (chunks) => (
                <Link
                  href={
                    billingEnabled ? "/dashboard/settings/billing" : "/contact"
                  }
                  className="font-semibold text-brand-primary underline underline-offset-2"
                >
                  {chunks}
                </Link>
              ),
            },
          )}
        </p>
      ) : null}

      {openPhoto ? (
        <MediaLightbox
          items={visibleImages}
          originFor={originFor}
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
