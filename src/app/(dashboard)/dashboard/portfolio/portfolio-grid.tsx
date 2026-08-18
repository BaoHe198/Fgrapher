"use client";

import type { MediaType } from "@prisma/client";
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
import { GripVertical, Upload, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { UploadMediaModal } from "@/components/modals/upload-media-modal";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
}

interface PortfolioGridProps {
  profileId: string;
  initialMedia: MediaItem[];
}

function SortableMediaTile({ item, onDelete }: { item: MediaItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-4/3 overflow-hidden rounded-xl bg-bg-sunken",
        isDragging && "opacity-50",
      )}
    >
      {item.type === "VIDEO" ? (
        <video src={item.url} className="size-full object-cover" muted />
      ) : (
        <Image src={item.url} alt={item.title ?? ""} fill className="object-cover" unoptimized />
      )}

      <div className="absolute inset-0 flex flex-col justify-between bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <div className="flex justify-between p-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex size-7 cursor-grab items-center justify-center rounded-full bg-white/20 text-white"
            aria-label="Reorder"
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white"
            aria-label="Delete"
          >
            <X className="size-4" />
          </button>
        </div>
        {item.title ? (
          <p className="p-2 text-body-sm text-white">{item.title}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PortfolioGrid({ profileId, initialMedia }: PortfolioGridProps) {
  const [media, setMedia] = useState(initialMedia);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDelete = async (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
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
    <>
      <p className="text-body-sm text-text-secondary">
        {media.length} item{media.length === 1 ? "" : "s"} · Drag to reorder
      </p>

      <DndContext
        id="portfolio-media"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <SortableMediaTile key={item.id} item={item} onDelete={onDelete} />
            ))}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-default text-text-tertiary transition-colors duration-150 hover:border-brand-primary hover:text-brand-primary"
            >
              <Upload className="size-[22px]" />
              <span className="text-body-sm">Upload</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      <UploadMediaModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        profileId={profileId}
        onUploaded={(items) => setMedia((prev) => [...prev, ...items])}
      />
    </>
  );
}
