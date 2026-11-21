"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { compressImageFile } from "@/lib/media/image-compression";
import { cn } from "@/lib/utils";

export interface NewPlacePhoto {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
}

export interface ExistingPlacePhoto {
  id: string;
  url: string;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_REJECTED";
  moderationNote?: string | null;
}

// A spot's photos are shown large on its page, so they keep more pixels
// than a reference photo; still compressed, since phones shoot 12MP+.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 2400;

function upload(
  cloudName: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<{
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("bad_response"));
        }
      } else reject(new Error(`status_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(form);
  });
}

/**
 * Photos of a spot: images only, uploaded straight to Cloudinary into the
 * uploader's own "place" folder (the server checks each one again before
 * saving — lib/media/cloudinary.ts verifyPlacePhotoUpload).
 */
export function PlacePhotoField({
  existing,
  onExistingChange,
  value,
  onChange,
  max,
  error,
  hint,
}: {
  /** Replaces the default "reviewed before shown" line (an admin's own
   * photos go in approved). */
  hint?: string;
  existing: ExistingPlacePhoto[];
  onExistingChange: (next: ExistingPlacePhoto[]) => void;
  value: NewPlacePhoto[];
  onChange: (next: NewPlacePhoto[]) => void;
  max: number;
  error?: string;
}) {
  const t = useTranslations("places.form");
  const inputId = useId();
  const hintId = useId();
  const [uploading, setUploading] = useState<
    { id: string; name: string; percent: number }[]
  >([]);
  const [errors, setErrors] = useState<string[]>([]);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const slotsLeft = max - existing.length - value.length - uploading.length;

  const handleFiles = async (files: File[]) => {
    const nextErrors: string[] = [];
    const images = files.filter((file) => {
      if (file.type.startsWith("image/")) return true;
      nextErrors.push(t("notImage", { name: file.name }));
      return false;
    });
    const accepted = images.slice(0, Math.max(0, slotsLeft));
    setErrors(nextErrors);
    if (accepted.length === 0) return;

    let sig: {
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
      transformation: string;
      allowedFormats: string;
    };
    try {
      const res = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "place" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "signature");
      sig = body.data;
    } catch {
      setErrors((prev) => [...prev, t("uploadUnavailable")]);
      return;
    }

    const results = await Promise.all(
      accepted.map(async (file) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setUploading((prev) => [...prev, { id, name: file.name, percent: 0 }]);
        try {
          const payload = await compressImageFile(file, {
            maxBytes: MAX_BYTES,
            maxDimension: MAX_DIMENSION,
          });
          const form = new FormData();
          form.append("file", payload);
          form.append("api_key", sig.apiKey);
          form.append("timestamp", String(sig.timestamp));
          form.append("signature", sig.signature);
          form.append("folder", sig.folder);
          form.append("transformation", sig.transformation);
          form.append("allowed_formats", sig.allowedFormats);
          const uploaded = await upload(sig.cloudName, form, (percent) =>
            setUploading((prev) =>
              prev.map((u) => (u.id === id ? { ...u, percent } : u)),
            ),
          );
          return {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            width: uploaded.width ?? null,
            height: uploaded.height ?? null,
          } satisfies NewPlacePhoto;
        } catch {
          setErrors((prev) => [
            ...prev,
            t("uploadFailed", { name: file.name }),
          ]);
          return null;
        } finally {
          setUploading((prev) => prev.filter((u) => u.id !== id));
        }
      }),
    );
    const added = results.filter((r): r is NewPlacePhoto => r !== null);
    if (added.length > 0) onChange([...latest.current, ...added]);
  };

  const tile =
    "relative size-24 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken";
  const removeButton =
    "absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-2">
      <p id={hintId} className="text-body-sm text-text-secondary">
        {hint ?? t("photosHint", { max })}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {existing.map((photo) => (
          <div key={photo.id} className={tile}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small thumbnail */}
            <img src={photo.url} alt="" className="size-full object-cover" />
            {photo.moderationStatus !== "APPROVED" ? (
              <Badge
                variant={
                  photo.moderationStatus === "PENDING"
                    ? "neutral"
                    : "destructive"
                }
                className="absolute bottom-1 left-1 max-w-[88px] truncate px-1.5 py-0.5 text-[11px]"
              >
                {photo.moderationStatus === "PENDING"
                  ? t("photoPending")
                  : t("photoRejected")}
              </Badge>
            ) : null}
            <button
              type="button"
              aria-label={t("removePhoto")}
              className={removeButton}
              onClick={() =>
                onExistingChange(existing.filter((p) => p.id !== photo.id))
              }
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {value.map((photo, index) => (
          <div key={photo.publicId} className={tile}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small thumbnail */}
            <img src={photo.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              aria-label={t("removePhoto")}
              className={removeButton}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {uploading.map((u) => (
          <div
            key={u.id}
            className={cn(
              tile,
              "flex flex-col items-center justify-center gap-1 text-text-tertiary",
            )}
            aria-live="polite"
          >
            <Loader2 className="size-4 animate-spin" />
            <span className="text-caption tabular-nums">
              {t("uploading", { percent: u.percent })}
            </span>
          </div>
        ))}
        {slotsLeft > 0 ? (
          <label
            htmlFor={inputId}
            className={cn(
              "flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--fg-radius-sm)] border-2 border-dashed text-text-tertiary transition-colors hover:border-border-strong hover:text-text-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border-focus",
              error ? "border-danger" : "border-border-default",
            )}
          >
            <Plus className="size-5" />
            <span className="text-caption">{t("addPhoto")}</span>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              aria-describedby={hintId}
              aria-invalid={error ? true : undefined}
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 0) void handleFiles(files);
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="flex flex-col gap-0.5" role="alert">
          {errors.map((message, i) => (
            <li key={i} className="text-body-sm text-danger">
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
