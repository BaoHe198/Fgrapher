"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { compressImageFile } from "@/lib/image-compression";

// Shared by dashboard/settings/profile/account-media.tsx and the public
// profile page's inline hero editor (profile-hero.tsx) — both need the
// exact same validate → crop → compress → upload → PATCH /api/users/me
// flow for avatar/cover, only the surrounding markup differs between the
// two call sites. Extracted here rather than duplicated so the two never
// drift (e.g. one gaining a size-limit bump the other misses).

// Raised from 5MB — modern phone photos routinely land in the 8-15MB
// range at full resolution. Kept bounded (not removed outright) so a
// pathological multi-hundred-MB pick doesn't hang the crop dialog's canvas
// or blow past Cloudinary's own account-level upload cap.
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The crop dialog (image-crop.ts) outputs the cropped region at its full
// native pixel resolution and quality 0.92 — plenty large for a source
// photo from a modern phone even after cropping down to a small avatar or
// a wide cover banner. Compress that output before it goes to Cloudinary;
// this is a display image, not something anyone needs at full photo
// resolution.
const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const UPLOAD_MAX_DIMENSION = 1600;

export type MediaTarget = "avatar" | "cover";

async function uploadFile(
  file: File,
  messages: { unavailable: string; failed: string },
) {
  const sigRes = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "account" }),
  });
  const sigBody = await sigRes.json();
  if (!sigRes.ok) throw new Error(sigBody.message ?? messages.unavailable);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sigBody.data.apiKey);
  formData.append("timestamp", String(sigBody.data.timestamp));
  formData.append("signature", sigBody.data.signature);
  formData.append("folder", sigBody.data.folder);
  formData.append("transformation", sigBody.data.transformation);
  formData.append("allowed_formats", sigBody.data.allowedFormats);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sigBody.data.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const result = await res.json();
  if (!res.ok) throw new Error(messages.failed);
  return result.secure_url as string;
}

export function useAccountMediaUpload({
  initialAvatar,
  initialCoverImage,
}: {
  initialAvatar: string | null;
  initialCoverImage: string | null;
}) {
  const t = useTranslations("dashboardSettings.profile.media");
  const [avatar, setAvatar] = useState(initialAvatar);
  const [coverImage, setCoverImage] = useState(initialCoverImage);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<MediaTarget | null>(null);

  // Crop dialog state — set together whenever a valid file is picked, for
  // either target; ImageCropDialog itself is generic over `aspect`.
  const [cropTarget, setCropTarget] = useState<MediaTarget | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [pendingFileMeta, setPendingFileMeta] = useState<{
    name: string;
    type: string;
  } | null>(null);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t("invalidType"));
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError(t("tooLarge"));
      return false;
    }
    return true;
  };

  const onFileSelected = (file: File, target: MediaTarget) => {
    setError(null);
    if (!validateFile(file)) return;
    setPendingFileMeta({ name: file.name, type: file.type });
    setCropImageSrc(URL.createObjectURL(file));
    setCropTarget(target);
  };

  const handleUpload = async (file: File, target: MediaTarget) => {
    setError(null);
    setUploading(target);
    try {
      const compressed = await compressImageFile(file, {
        maxBytes: UPLOAD_MAX_BYTES,
        maxDimension: UPLOAD_MAX_DIMENSION,
      });
      const url = await uploadFile(compressed, {
        unavailable: t("uploadUnavailable"),
        failed: t("uploadFailed"),
      });

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target === "avatar" ? { avatar: url } : { coverImage: url },
        ),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? t("uploadFailed"));
        return;
      }

      if (target === "avatar") setAvatar(url);
      else setCoverImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(null);
    }
  };

  const closeCrop = () => {
    setCropTarget(null);
    setCropImageSrc(null);
  };

  const onCropped = (file: File) => {
    if (cropTarget) void handleUpload(file, cropTarget);
    setCropImageSrc(null);
  };

  return {
    avatar,
    coverImage,
    error,
    uploading,
    cropTarget,
    cropImageSrc,
    pendingFileMeta,
    onFileSelected,
    closeCrop,
    onCropped,
  };
}
