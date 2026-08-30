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
import {
  ArrowLeft,
  GripVertical,
  Loader2,
  Star,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { UploadMediaModal } from "@/components/modals/upload-media-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { buildMediaVariants } from "@/lib/media-variants";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
  moderationStatus: string;
  moderationNote: string | null;
}

interface AlbumMeta {
  id: string;
  title: string;
  description: string | null;
  category: ProfileCategory | null;
  shootDate: string | null;
  coverMediaId: string | null;
}

const MODERATION_BADGE_VARIANT: Record<
  string,
  "warning" | "destructive" | undefined
> = {
  PENDING: "warning",
  REJECTED: "destructive",
  AUTO_REJECTED: "destructive",
};

function SortableMediaTile({
  item,
  isCover,
  onDelete,
  onSetCover,
  t,
}: {
  item: MediaItem;
  isCover: boolean;
  onDelete: (id: string) => void;
  onSetCover: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-4/3 overflow-hidden rounded-xl bg-bg-sunken",
        isDragging && "opacity-50",
        isCover && "ring-2 ring-brand-primary",
      )}
    >
      {item.type === "VIDEO" ? (
        <video src={item.url} className="size-full object-cover" muted />
      ) : (
        <Image
          src={buildMediaVariants(item.url).thumbnail}
          alt={item.title ?? ""}
          fill
          className="object-cover"
          unoptimized
        />
      )}

      {MODERATION_BADGE_VARIANT[item.moderationStatus] ? (
        <Badge
          variant={MODERATION_BADGE_VARIANT[item.moderationStatus]!}
          className="absolute top-2 left-2"
        >
          {item.moderationStatus === "PENDING"
            ? t("moderation.pending")
            : t("moderation.rejected")}
        </Badge>
      ) : null}
      {isCover ? (
        <Badge variant="accent" className="absolute top-2 right-2">
          {t("coverBadge")}
        </Badge>
      ) : null}

      <div className="absolute inset-0 flex flex-col justify-between bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <div className="flex justify-between p-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex size-7 cursor-grab items-center justify-center rounded-full bg-white/20 text-white"
            aria-label={t("reorder")}
          >
            <GripVertical className="size-4" />
          </button>
          <div className="flex gap-1">
            {!isCover ? (
              <button
                type="button"
                onClick={() => onSetCover(item.id)}
                className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white"
                aria-label={t("setCover")}
              >
                <Star className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white"
              aria-label={t("delete")}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlbumDetail({
  backLabel,
  profileId,
  role,
  album,
  initialMedia,
}: {
  backLabel: string;
  profileId: string;
  role: Role;
  album: AlbumMeta;
  initialMedia: MediaItem[];
}) {
  const t = useTranslations("dashboardCore.albums.detail");
  const categoryT = useTranslations("profileCategory");
  const [media, setMedia] = useState(initialMedia);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meta, setMeta] = useState(album);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const categoryOptions = CATEGORIES_BY_ROLE[role] ?? [];

  const saveMeta = async () => {
    setIsSaving(true);
    setSaved(false);
    const res = await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: meta.title,
        description: meta.description || null,
        category: meta.category ?? undefined,
        shootDate: meta.shootDate || null,
      }),
    });
    setIsSaving(false);
    if (res.ok) setSaved(true);
  };

  const onDelete = async (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    toast.add({ title: t("photoTrashedToast"), type: "success" });
  };

  const onSetCover = async (id: string) => {
    setMeta((prev) => ({ ...prev, coverMediaId: id }));
    await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverMediaId: id }),
    });
    toast.add({ title: t("coverUpdatedToast"), type: "success" });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = media.findIndex((m) => m.id === active.id);
    const newIndex = media.findIndex((m) => m.id === over.id);
    const next = arrayMove(media, oldIndex, newIndex);
    setMedia(next);

    await fetch("/api/portfolio/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((m) => m.id) }),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/portfolio"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-3.5 rounded-[var(--fg-radius-md)] border border-border-subtle p-4">
        <Input
          label={t("titleLabel")}
          value={meta.title}
          onChange={(e) => setMeta((p) => ({ ...p, title: e.target.value }))}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-body-sm font-semibold! text-text-primary">
            {t("descriptionLabel")}
          </label>
          <Textarea
            rows={2}
            value={meta.description ?? ""}
            onChange={(e) =>
              setMeta((p) => ({ ...p, description: e.target.value }))
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NativeSelect
            label={t("categoryLabel")}
            value={meta.category ?? ""}
            onChange={(value) =>
              setMeta((p) => ({
                ...p,
                category: (value || null) as ProfileCategory | null,
              }))
            }
            options={[
              { value: "", label: t("categoryPlaceholder") },
              ...categoryOptions.map((c) => ({
                value: c,
                label: categoryT(c),
              })),
            ]}
          />
          <Input
            label={t("shootDateLabel")}
            type="date"
            value={meta.shootDate?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setMeta((p) => ({ ...p, shootDate: e.target.value }))
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={isSaving}
            onClick={saveMeta}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
          {saved ? (
            <span className="text-body-sm text-success">{t("saved")}</span>
          ) : null}
        </div>
      </div>

      <p className="text-body-sm text-text-secondary">
        {t("photoCount", { count: media.length })} · {t("dragToReorder")}
      </p>

      <DndContext
        id="album-media"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={media.map((m) => m.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <SortableMediaTile
                key={item.id}
                item={item}
                isCover={item.id === meta.coverMediaId}
                onDelete={onDelete}
                onSetCover={onSetCover}
                t={t}
              />
            ))}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-default text-text-tertiary transition-colors duration-150 hover:border-brand-primary hover:text-brand-primary"
            >
              <Upload className="size-[22px]" />
              <span className="text-body-sm">{t("upload")}</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      <UploadMediaModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        profileId={profileId}
        albumId={album.id}
        role={role}
        onUploaded={(items) => setMedia((prev) => [...prev, ...items])}
      />
    </div>
  );
}
