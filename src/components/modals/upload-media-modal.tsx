"use client";

import type { Role } from "@prisma/client";
import { Film, Loader2, UploadCloud, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { compressImageFile } from "@/lib/media/image-compression";
import { youtubeVideoId, youtubeWatchUrl } from "@/lib/media/video-link";
import { CATEGORIES_BY_ROLE } from "@/lib/constants";

const NEW_ALBUM_VALUE = "__new__";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// Portfolio images are provider marketing content, shown at meaningful
// display sizes (profile grids, lightbox) — kept larger/higher-quality
// than the avatar/cover pipeline, but still well under the raw 10MB cap a
// modern phone photo can hit. Videos are left untouched: compressImageFile
// only knows how to decode images via createImageBitmap.
const UPLOAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_IMAGE_MAX_DIMENSION = 2400;
const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};
const MEDIA_ACCEPT = {
  ...IMAGE_ACCEPT,
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
};

interface PendingFile {
  file: File;
  title: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

// A YouTube link waiting to be added: a video too long for the 100MB
// upload, already published there (lib/media/video-link.ts).
interface PendingLink {
  url: string;
  title: string;
  status: "pending" | "saving" | "done" | "error";
  error?: string;
}

interface UploadedMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  title: string | null;
  moderationStatus: string;
  moderationNote: string | null;
}

interface UploadMediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  // Prompt G3, VIỆC 3 — "Bước 1: chọn album đích". When the caller already
  // knows the target album (e.g. uploading from inside an album's own
  // detail page), pass it directly and this whole step is skipped.
  // Otherwise an album picker (existing albums + "create new inline")
  // renders first, matching the prompt's Bước 1.
  albumId?: string;
  role?: Role;
  allowStandalone?: boolean;
  imageOnly?: boolean;
  onUploaded: (items: UploadedMedia[]) => void;
}

interface AlbumOption {
  id: string;
  title: string;
}

function uploadToCloudinary(
  file: File,
  signature: {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    transformation: string;
    allowedFormats: string;
  },
  onProgress: (percent: number) => void,
) {
  return new Promise<{
    secure_url: string;
    public_id: string;
    width?: number;
    height?: number;
    resource_type: string;
  }>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("folder", signature.folder);
    formData.append("transformation", signature.transformation);
    formData.append("allowed_formats", signature.allowedFormats);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

export function UploadMediaModal({
  open,
  onOpenChange,
  profileId,
  albumId,
  role,
  allowStandalone = false,
  imageOnly = false,
  onUploaded,
}: UploadMediaModalProps) {
  const t = useTranslations("sharedComponents.uploadMediaModal");
  const categoryT = useTranslations("profileCategory");
  const [files, setFiles] = useState<PendingFile[]>([]);
  // Files the drop zone turned away, with why. The validator below already
  // wrote the reasons ("Ảnh phải nhỏ hơn 10MB"), but nothing showed them: a
  // photo straight off a camera is often over the limit, and choosing one
  // simply did nothing (found 19/11/2026).
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>(
    [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const addLink = () => {
    const id = youtubeVideoId(linkDraft);
    if (!id) {
      setLinkError(t("linkInvalid"));
      return;
    }
    const url = youtubeWatchUrl(id);
    if (links.some((link) => link.url === url)) {
      setLinkError(t("linkDuplicate"));
      return;
    }
    setLinks((prev) => [...prev, { url, title: "", status: "pending" }]);
    setLinkDraft("");
    setLinkError(null);
  };

  const needsAlbumPicker = !albumId && !allowStandalone;
  const [albums, setAlbums] = useState<AlbumOption[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumCategory, setNewAlbumCategory] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !needsAlbumPicker) return;
    fetch(`/api/albums?profileId=${profileId}`)
      .then((res) => res.json())
      .then((body) => {
        const list: AlbumOption[] = body.data ?? [];
        setAlbums(list);
        // A brand-new provider has no album yet: the picker showed an empty
        // "Choose an album" with "create new" buried inside it, which read
        // as a dead end on their very first upload (24/09 e2e run). Open the
        // create form straight away instead.
        if (list.length === 0) setSelectedAlbumId(NEW_ALBUM_VALUE);
      });
  }, [open, needsAlbumPicker, profileId]);

  const categoryOptions = role ? (CATEGORIES_BY_ROLE[role] ?? []) : [];

  // Resolved target album: the prop when the caller already knows it, or
  // the picker's selection once it points at a real (non-"create new")
  // album id.
  const resolvedAlbumId =
    albumId ??
    (selectedAlbumId && selectedAlbumId !== NEW_ALBUM_VALUE
      ? selectedAlbumId
      : null);

  const createAlbumInline = async () => {
    setAlbumError(null);
    if (!newAlbumCategory) {
      setAlbumError(t("albumCategoryRequired"));
      return;
    }
    // The title is optional (the API names the album after its category);
    // a single character is more likely a slip than a title.
    if (newAlbumTitle.trim().length === 1) {
      setAlbumError(t("albumTitleRequired"));
      return;
    }

    setIsCreatingAlbum(true);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        title: newAlbumTitle.trim() || undefined,
        category: newAlbumCategory,
      }),
    });
    const body = await res.json();
    setIsCreatingAlbum(false);

    if (!res.ok) {
      setAlbumError(body.message ?? t("albumCreateFailed"));
      return;
    }

    setAlbums((prev) => [
      ...prev,
      { id: body.data.id, title: body.data.title },
    ]);
    setSelectedAlbumId(body.data.id);
  };

  const onDrop = useCallback((accepted: File[]) => {
    // A new pick replaces the last pick's refusals.
    setRejected([]);
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        file,
        title: "",
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) =>
      setRejected(
        rejections.map(({ file, errors }) => ({
          name: file.name,
          // Our own validator's reasons are already in the app's language;
          // the drop zone's built-in ones (wrong type) are English.
          reason:
            errors.find((e) =>
              ["file-too-large", "video-not-allowed"].includes(e.code),
            )?.message ?? t(imageOnly ? "imageOnly" : "unsupportedType"),
        })),
      ),
    accept: imageOnly ? IMAGE_ACCEPT : MEDIA_ACCEPT,
    multiple: true,
    validator: (file) => {
      const isVideo = file.type.startsWith("video/");
      if (imageOnly && isVideo) {
        return { code: "video-not-allowed", message: t("imageOnly") };
      }
      const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > max) {
        return {
          code: "file-too-large",
          message: isVideo ? t("videoTooLarge") : t("imageTooLarge"),
        };
      }
      return null;
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const setTitle = (index: number, title: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, title } : f)));
  };

  const uploadAll = async () => {
    if (!rightsConfirmed || (!resolvedAlbumId && !allowStandalone)) return;
    setIsSubmitting(true);

    // Links first, and without Cloudinary: there is no file to send, so a
    // link can still be added where uploads are unavailable.
    const linked = await Promise.all(
      links.map(async (link, i): Promise<UploadedMedia | null> => {
        if (link.status === "done") return null;
        const mark = (next: Partial<PendingLink>) =>
          setLinks((prev) =>
            prev.map((cur, idx) => (idx === i ? { ...cur, ...next } : cur)),
          );
        mark({ status: "saving" });
        try {
          const res = await fetch("/api/portfolio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId,
              albumId: resolvedAlbumId ?? undefined,
              url: link.url,
              type: "VIDEO",
              title: link.title || undefined,
              rightsConfirmed,
            }),
          });
          const body = await res.json();
          if (!res.ok) {
            mark({ status: "error", error: body.message ?? t("uploadFailed") });
            return null;
          }
          mark({ status: "done" });
          return {
            id: body.data.id,
            url: body.data.url,
            type: "VIDEO",
            title: link.title || null,
            moderationStatus: body.data.moderationStatus,
            moderationNote: body.data.moderationNote,
          };
        } catch {
          mark({ status: "error", error: t("uploadFailed") });
          return null;
        }
      }),
    );
    const linkedMedia = linked.filter((r): r is UploadedMedia => r !== null);

    if (files.length === 0) {
      setIsSubmitting(false);
      if (linkedMedia.length === 0) return;
      onUploaded(linkedMedia);
      setLinks([]);
      onOpenChange(false);
      return;
    }

    const sigRes = await fetch("/api/upload/signature", { method: "POST" });
    const sigBody = await sigRes.json();

    if (!sigRes.ok) {
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error",
          error: sigBody.message ?? t("uploadUnavailable"),
        })),
      );
      setIsSubmitting(false);
      // The links that went in are in the album; show them.
      if (linkedMedia.length > 0) onUploaded(linkedMedia);
      return;
    }

    // Uploaded in parallel rather than one-at-a-time — each file's progress
    // is tracked independently via its own index, so concurrent XHRs don't
    // interfere with each other's state updates.
    const results = await Promise.all(
      files.map(async (f, i) => {
        setFiles((prev) =>
          prev.map((cur, idx) =>
            idx === i ? { ...cur, status: "uploading" } : cur,
          ),
        );

        try {
          const uploadFile = f.file.type.startsWith("image/")
            ? await compressImageFile(f.file, {
                maxBytes: UPLOAD_IMAGE_MAX_BYTES,
                maxDimension: UPLOAD_IMAGE_MAX_DIMENSION,
              })
            : f.file;

          const result = await uploadToCloudinary(
            uploadFile,
            sigBody.data,
            (percent) => {
              setFiles((prev) =>
                prev.map((cur, idx) =>
                  idx === i ? { ...cur, progress: percent } : cur,
                ),
              );
            },
          );

          const type = result.resource_type === "video" ? "VIDEO" : "IMAGE";
          const saveRes = await fetch("/api/portfolio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId,
              albumId: resolvedAlbumId ?? undefined,
              url: result.secure_url,
              publicId: result.public_id,
              type,
              title: f.title || undefined,
              width: result.width,
              height: result.height,
              rightsConfirmed,
            }),
          });
          const saveBody = await saveRes.json();

          if (!saveRes.ok) {
            throw new Error(saveBody.message ?? t("uploadFailed"));
          }

          setFiles((prev) =>
            prev.map((cur, idx) =>
              idx === i ? { ...cur, status: "done" } : cur,
            ),
          );

          return {
            id: saveBody.data.id,
            url: result.secure_url,
            type,
            title: f.title || null,
            moderationStatus: saveBody.data.moderationStatus,
            moderationNote: saveBody.data.moderationNote,
          } satisfies UploadedMedia;
        } catch {
          setFiles((prev) =>
            prev.map((cur, idx) =>
              idx === i
                ? { ...cur, status: "error", error: t("uploadFailed") }
                : cur,
            ),
          );
          return null;
        }
      }),
    );

    const uploaded = [
      ...linkedMedia,
      ...results.filter((r): r is UploadedMedia => r !== null),
    ];

    setIsSubmitting(false);
    if (uploaded.length === 0) return;

    onUploaded(uploaded);
    setFiles([]);
    setLinks([]);
    setRejected([]);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          onOpenChange(next);
          if (!next) {
            setFiles([]);
            setLinks([]);
            setLinkDraft("");
            setLinkError(null);
            setRejected([]);
            setSelectedAlbumId("");
            setNewAlbumTitle("");
            setNewAlbumCategory("");
            setAlbumError(null);
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {needsAlbumPicker ? (
          <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
            <NativeSelect
              label={t("albumPickerLabel")}
              value={selectedAlbumId}
              onChange={(value) => {
                setSelectedAlbumId(value);
                setAlbumError(null);
              }}
              options={[
                { value: "", label: t("albumPickerPlaceholder") },
                ...albums.map((a) => ({ value: a.id, label: a.title })),
                { value: NEW_ALBUM_VALUE, label: t("albumPickerCreateNew") },
              ]}
            />

            {selectedAlbumId === NEW_ALBUM_VALUE ? (
              <div className="flex flex-col gap-2.5">
                <Input
                  label={t("albumTitleLabel")}
                  placeholder={t("albumTitlePlaceholder")}
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                />
                <NativeSelect
                  label={t("albumCategoryLabel")}
                  value={newAlbumCategory}
                  onChange={setNewAlbumCategory}
                  options={[
                    { value: "", label: t("albumCategoryPlaceholder") },
                    ...categoryOptions.map((c) => ({
                      value: c,
                      label: categoryT(c),
                    })),
                  ]}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  disabled={isCreatingAlbum}
                  onClick={createAlbumInline}
                >
                  {isCreatingAlbum ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {t("albumCreateButton")}
                </Button>
              </div>
            ) : null}

            {albumError ? (
              <p className="text-body-sm text-danger">{albumError}</p>
            ) : null}
          </div>
        ) : null}

        {resolvedAlbumId || allowStandalone ? (
          <>
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center gap-2 rounded-[var(--fg-radius-md)] border-2 border-dashed p-8 text-center transition-colors duration-150 ${
                isDragActive
                  ? "border-brand-primary text-brand-primary"
                  : "border-border-default text-text-tertiary"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="size-6" />
              <p className="text-body-sm">{t("dropzone")}</p>
              <p className="text-body-sm text-text-tertiary">
                {t(imageOnly ? "sizeLimitsImageOnly" : "sizeLimits")}
              </p>
            </div>

            {rejected.length > 0 ? (
              <ul
                role="alert"
                className="flex flex-col gap-1 rounded-[var(--fg-radius-md)] bg-danger-bg px-3 py-2.5 text-body-sm text-danger"
              >
                {rejected.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="break-words">
                    <span className="font-semibold">{item.name}</span>
                    {" — "}
                    {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}

            {files.length > 0 ? (
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {files.map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] border border-border-default p-2.5"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-body-sm font-semibold! text-text-primary">
                          {f.file.name}
                        </span>
                        {f.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            aria-label={t("removeFile")}
                          >
                            <X className="size-3.5 text-text-tertiary" />
                          </button>
                        ) : null}
                      </div>
                      {f.status === "pending" ? (
                        <Input
                          placeholder={t("titlePlaceholder")}
                          value={f.title}
                          onChange={(e) => setTitle(index, e.target.value)}
                          className="mt-1.5"
                        />
                      ) : f.status === "uploading" ? (
                        <Progress value={f.progress} className="mt-1.5" />
                      ) : f.status === "error" ? (
                        <p className="mt-1 text-body-sm text-danger">
                          {f.error}
                        </p>
                      ) : (
                        <p className="mt-1 text-body-sm text-success">
                          {t("uploaded")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {imageOnly ? null : (
              <div className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <Input
                    label={t("linkLabel")}
                    placeholder={t("linkPlaceholder")}
                    inputMode="url"
                    value={linkDraft}
                    error={linkError ?? undefined}
                    onChange={(e) => {
                      setLinkDraft(e.target.value);
                      setLinkError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    className={linkError ? "mb-6" : undefined}
                    disabled={!linkDraft.trim() || isSubmitting}
                    onClick={addLink}
                  >
                    {t("linkAdd")}
                  </Button>
                </div>
                <p className="text-meta text-text-tertiary">
                  {t("linkHelper")}
                </p>
                {links.map((link, index) => (
                  <div
                    key={link.url}
                    className="flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] border border-border-default p-2.5"
                  >
                    <Film
                      aria-hidden
                      className="size-5 shrink-0 text-text-tertiary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-body-sm font-semibold! text-text-primary">
                          {t("linkItem")} · {link.url.split("v=")[1]}
                        </span>
                        {link.status === "pending" ||
                        link.status === "error" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLinks((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            aria-label={t("removeLink")}
                          >
                            <X className="size-3.5 text-text-tertiary" />
                          </button>
                        ) : null}
                      </div>
                      {link.status === "pending" ? (
                        <Input
                          placeholder={t("titlePlaceholder")}
                          aria-label={t("titlePlaceholder")}
                          value={link.title}
                          onChange={(e) =>
                            setLinks((prev) =>
                              prev.map((cur, i) =>
                                i === index
                                  ? { ...cur, title: e.target.value }
                                  : cur,
                              ),
                            )
                          }
                          className="mt-1.5"
                        />
                      ) : link.status === "saving" ? (
                        <Loader2 className="mt-1.5 size-4 animate-spin text-text-tertiary" />
                      ) : link.status === "error" ? (
                        <p className="mt-1 text-body-sm text-danger">
                          {link.error}
                        </p>
                      ) : (
                        <p className="mt-1 text-body-sm text-success">
                          {t("uploaded")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Checkbox
              checked={rightsConfirmed}
              onCheckedChange={(checked) =>
                setRightsConfirmed(checked === true)
              }
              label={t("rightsConfirm")}
            />

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={
                files.length + links.length === 0 ||
                isSubmitting ||
                !rightsConfirmed
              }
              onClick={uploadAll}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                t("upload", { count: files.length + links.length || "" })
              )}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
