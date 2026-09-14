"use client";

import { Loader2, Play, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { compressImageFile } from "@/lib/image-compression";
import { type MediaKind, mediaKindFromUrl } from "@/lib/media-kind";
import { cn } from "@/lib/utils";

export interface ReferenceMedia {
  url: string;
  publicId?: string;
}

// Reference media is visual context for a provider deciding how to shoot —
// nobody views it at full resolution, so photos are compressed hard before
// upload, same as the request wizard always did.
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1600;

// Half the portfolio's 100MB video cap, on purpose. Portfolio uploads are
// limited to paid provider accounts; reference uploads are open to every
// signed-in account, including free CUSTOMER-only ones. And the size check
// is client-side only — lib/cloudinary.ts documents that there is no
// server-side cap — so this number is effectively the storage bill a single
// free account can run up per file. 50MB still fits a minute or so of phone
// video, which is what a reference clip actually is.
export const REFERENCE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm";

interface ReferenceMediaFieldProps {
  value: ReferenceMedia[];
  onChange: (next: ReferenceMedia[]) => void;
  max: number;
  // Which Cloudinary folder the signature is scoped to — see
  // api/upload/signature's openPurposes.
  purpose: "request" | "booking";
  className?: string;
}

interface Uploading {
  id: string;
  name: string;
  kind: MediaKind;
  percent: number;
}

function kindOfFile(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("image/")) return "IMAGE";
  return null;
}

// XHR rather than fetch() because fetch has no upload progress, and a 50MB
// video on a phone connection with no progress indicator looks frozen —
// people cancel, retry, and upload it twice.
function uploadToCloudinary(
  cloudName: string,
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
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
      } else {
        reject(new Error(`status_${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(form);
  });
}

/**
 * "Ảnh/Video tham khảo" — photos or videos a customer attaches so a
 * provider can see the look they're after. Shared by the service-request
 * wizard and the booking wizard, which previously had one image-only
 * uploader inline and none at all respectively.
 */
export function ReferenceMediaField({
  value,
  onChange,
  max,
  purpose,
  className,
}: ReferenceMediaFieldProps) {
  const t = useTranslations("sharedComponents.referenceMedia");
  const inputId = useId();
  const hintId = useId();
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Uploads finish seconds (a video: minutes) after they start. If the user
  // removes a file in the meantime, committing against the `value` captured
  // when the upload began would put that removed file straight back. Always
  // commit against the latest list instead.
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const videoMb = Math.round(REFERENCE_VIDEO_MAX_BYTES / (1024 * 1024));
  const slotsLeft = max - value.length - uploading.length;

  const handleFiles = async (files: File[]) => {
    const nextErrors: string[] = [];
    const accepted: { file: File; kind: MediaKind }[] = [];

    for (const file of files) {
      const kind = kindOfFile(file);
      if (!kind) {
        nextErrors.push(t("errorUnsupported", { name: file.name }));
        continue;
      }
      if (kind === "VIDEO" && file.size > REFERENCE_VIDEO_MAX_BYTES) {
        nextErrors.push(t("errorTooLarge", { name: file.name, videoMb }));
        continue;
      }
      accepted.push({ file, kind });
    }

    const room = Math.max(0, slotsLeft);
    if (accepted.length > room) {
      nextErrors.push(
        t("errorLimit", { max, skipped: accepted.length - room }),
      );
      accepted.length = room;
    }
    setErrors(nextErrors);
    if (accepted.length === 0) return;

    // One signature covers the whole batch — it's scoped to a folder and a
    // timestamp, not to a single file.
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
        body: JSON.stringify({ purpose }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "signature");
      sig = body.data;
    } catch {
      setErrors((prev) => [...prev, t("errorUnavailable")]);
      return;
    }

    const results = await Promise.all(
      accepted.map(async ({ file, kind }) => {
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setUploading((prev) => [
          ...prev,
          { id, name: file.name, kind, percent: 0 },
        ]);
        try {
          const payload =
            kind === "IMAGE"
              ? await compressImageFile(file, {
                  maxBytes: IMAGE_MAX_BYTES,
                  maxDimension: IMAGE_MAX_DIMENSION,
                })
              : file; // never through the canvas — that would destroy a video

          const form = new FormData();
          form.append("file", payload);
          form.append("api_key", sig.apiKey);
          form.append("timestamp", String(sig.timestamp));
          form.append("signature", sig.signature);
          form.append("folder", sig.folder);
          form.append("transformation", sig.transformation);
          form.append("allowed_formats", sig.allowedFormats);

          const uploaded = await uploadToCloudinary(
            sig.cloudName,
            form,
            (percent) =>
              setUploading((prev) =>
                prev.map((u) => (u.id === id ? { ...u, percent } : u)),
              ),
          );
          return {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
          } as ReferenceMedia;
        } catch {
          setErrors((prev) => [...prev, t("errorFailed", { name: file.name })]);
          return null;
        } finally {
          setUploading((prev) => prev.filter((u) => u.id !== id));
        }
      }),
    );

    const added = results.filter((r): r is ReferenceMedia => r !== null);
    if (added.length > 0) onChange([...latestValue.current, ...added]);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {t("label")}
        </label>
        <span className="text-body-sm text-text-tertiary tabular-nums">
          {t("count", { count: value.length, max })}
        </span>
      </div>
      <p id={hintId} className="text-body-sm text-text-tertiary">
        {t("hint", { max, videoMb })}
      </p>

      <div className="flex flex-wrap gap-2.5">
        {value.map((item, index) => {
          const kind = mediaKindFromUrl(item.url);
          return (
            <div
              key={item.url}
              className="relative size-20 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken"
            >
              {kind === "VIDEO" ? (
                <>
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play
                        className="size-3 fill-current"
                        aria-label={t("video")}
                      />
                    </span>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- small reference thumbnail, not worth next/image config
                <img src={item.url} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={t("remove")}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}

        {uploading.map((u) => (
          <div
            key={u.id}
            className="relative flex size-20 flex-col items-center justify-center gap-1 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken text-text-tertiary"
            aria-live="polite"
          >
            <Loader2 className="size-4 animate-spin" />
            <span className="text-caption tabular-nums">
              {t("uploadingPercent", { percent: u.percent })}
            </span>
            <span
              className="absolute inset-x-0 bottom-0 h-1 bg-brand-primary transition-[width] duration-200"
              style={{ width: `${u.percent}%` }}
            />
          </div>
        ))}

        {/* The add tile disappears once the list is full, rather than
            staying on screen as a control that silently does nothing. */}
        {slotsLeft > 0 ? (
          <label
            htmlFor={inputId}
            className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--fg-radius-sm)] border-2 border-dashed border-border-default text-text-tertiary transition-colors hover:border-border-strong hover:text-text-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border-focus"
          >
            <Plus className="size-5" />
            <span className="sr-only">{t("add")}</span>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple
              aria-describedby={hintId}
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) void handleFiles(files);
              }}
            />
          </label>
        ) : null}
      </div>

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
