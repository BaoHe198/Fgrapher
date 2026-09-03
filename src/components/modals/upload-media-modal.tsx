"use client";

import type { Role } from "@prisma/client";
import { Loader2, UploadCloud, X } from "lucide-react";
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
import { CATEGORIES_BY_ROLE } from "@/lib/constants";

const NEW_ALBUM_VALUE = "__new__";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
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
  onUploaded,
}: UploadMediaModalProps) {
  const t = useTranslations("sharedComponents.uploadMediaModal");
  const categoryT = useTranslations("profileCategory");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const needsAlbumPicker = !albumId;
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
      .then((body) => setAlbums(body.data ?? []));
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
    if (newAlbumTitle.trim().length < 2) {
      setAlbumError(t("albumTitleRequired"));
      return;
    }
    if (!newAlbumCategory) {
      setAlbumError(t("albumCategoryRequired"));
      return;
    }

    setIsCreatingAlbum(true);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        title: newAlbumTitle.trim(),
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
    accept: ACCEPT,
    multiple: true,
    validator: (file) => {
      const isVideo = file.type.startsWith("video/");
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
    if (!rightsConfirmed || !resolvedAlbumId) return;
    setIsSubmitting(true);

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
      return;
    }

    const uploaded: UploadedMedia[] = [];

    for (let i = 0; i < files.length; i++) {
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)),
      );

      try {
        const result = await uploadToCloudinary(
          files[i].file,
          sigBody.data,
          (percent) => {
            setFiles((prev) =>
              prev.map((f, idx) =>
                idx === i ? { ...f, progress: percent } : f,
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
            albumId: resolvedAlbumId,
            url: result.secure_url,
            publicId: result.public_id,
            type,
            title: files[i].title || undefined,
            width: result.width,
            height: result.height,
            rightsConfirmed,
          }),
        });
        const saveBody = await saveRes.json();
        if (saveRes.ok) {
          uploaded.push({
            id: saveBody.data.id,
            url: result.secure_url,
            type,
            title: files[i].title || null,
            moderationStatus: saveBody.data.moderationStatus,
            moderationNote: saveBody.data.moderationNote,
          });
        }

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f)),
        );
      } catch {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: t("uploadFailed") } : f,
          ),
        );
      }
    }

    setIsSubmitting(false);
    onUploaded(uploaded);
    setFiles([]);
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

        {resolvedAlbumId ? (
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
                {t("sizeLimits")}
              </p>
            </div>

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
              disabled={files.length === 0 || isSubmitting || !rightsConfirmed}
              onClick={uploadAll}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("uploading")}
                </>
              ) : (
                t("upload", { count: files.length || "" })
              )}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
