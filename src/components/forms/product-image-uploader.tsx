"use client";

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
import { GripVertical, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { cn } from "@/lib/utils";

export interface ProductImage {
  url: string;
  publicId?: string;
}

interface ProductImageUploaderProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

function SortableThumb({
  image,
  onRemove,
}: {
  image: ProductImage;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.url,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken",
        isDragging && "opacity-50",
      )}
    >
      <Image src={image.url} alt="" fill className="object-cover" unoptimized />
      <div className="absolute inset-0 flex items-start justify-between bg-black/40 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-6 cursor-grab items-center justify-center rounded-full bg-white/20 text-white"
          aria-label="Reorder"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-6 items-center justify-center rounded-full bg-white/20 text-white"
          aria-label="Remove"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ProductImageUploader({ images, onChange }: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDrop = useCallback(
    async (accepted: File[]) => {
      setError(null);
      setIsUploading(true);

      const sigRes = await fetch("/api/upload/signature", { method: "POST" });
      const sigBody = await sigRes.json();
      if (!sigRes.ok) {
        setError(sigBody.message ?? "Upload unavailable");
        setIsUploading(false);
        return;
      }

      const uploaded: ProductImage[] = [];
      for (const file of accepted) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", sigBody.data.apiKey);
        formData.append("timestamp", String(sigBody.data.timestamp));
        formData.append("signature", sigBody.data.signature);
        formData.append("folder", sigBody.data.folder);

        try {
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${sigBody.data.cloudName}/auto/upload`,
            { method: "POST", body: formData },
          );
          const result = await res.json();
          if (res.ok) {
            uploaded.push({ url: result.secure_url, publicId: result.public_id });
          }
        } catch {
          setError("One or more uploads failed");
        }
      }

      onChange([...images, ...uploaded]);
      setIsUploading(false);
    },
    [images, onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    multiple: true,
  });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.url === active.id);
    const newIndex = images.findIndex((i) => i.url === over.id);
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <DndContext id="product-images" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={images.map((i) => i.url)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
            {images.map((image) => (
              <SortableThumb
                key={image.url}
                image={image}
                onRemove={() => onChange(images.filter((i) => i.url !== image.url))}
              />
            ))}

            <div
              {...getRootProps()}
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--fg-radius-sm)] border-2 border-dashed text-text-tertiary transition-colors duration-150",
                isDragActive ? "border-brand-primary text-brand-primary" : "border-border-default",
              )}
            >
              <input {...getInputProps()} />
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
