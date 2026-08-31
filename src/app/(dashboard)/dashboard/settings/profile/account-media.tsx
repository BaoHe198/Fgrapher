"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState } from "react";

import { ImageCropDialog } from "@/components/profile/image-crop-dialog";

// Raised from 5MB — modern phone photos routinely land in the 8-15MB
// range at full resolution. Kept bounded (not removed outright) so a
// pathological multi-hundred-MB pick doesn't hang the crop dialog's canvas
// or blow past Cloudinary's own account-level upload cap.
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

export function AccountMedia({
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
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  // Crop dialog state — set together whenever a valid file is picked, for
  // either target; the dialog itself is generic over `aspect`.
  const [cropTarget, setCropTarget] = useState<"avatar" | "cover" | null>(null);
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

  const onFileSelected = (file: File, target: "avatar" | "cover") => {
    setError(null);
    if (!validateFile(file)) return;
    setPendingFileMeta({ name: file.name, type: file.type });
    setCropImageSrc(URL.createObjectURL(file));
    setCropTarget(target);
  };

  const handleUpload = async (file: File, target: "avatar" | "cover") => {
    setError(null);
    setUploading(target);
    try {
      const url = await uploadFile(file, {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-3/1 w-full overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : null}
        <button
          type="button"
          onClick={() => coverInput.current?.click()}
          className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-body-sm text-white"
        >
          {uploading === "cover" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {t("coverButton")}
        </button>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file, "cover");
            e.target.value = "";
          }}
        />
      </div>

      <div className="-mt-10 ml-4 flex items-end gap-3">
        <div className="relative size-[104px] shrink-0 overflow-hidden rounded-full border-4 border-bg-surface bg-bg-sunken">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : null}
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
          >
            {uploading === "avatar" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file, "avatar");
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <p className="text-body-sm text-text-tertiary">{t("sizeLimit")}</p>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <ImageCropDialog
        open={cropTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCropTarget(null);
            setCropImageSrc(null);
          }
        }}
        imageSrc={cropImageSrc}
        aspect={cropTarget === "avatar" ? 1 : 3}
        fileName={pendingFileMeta?.name ?? "image"}
        mimeType={pendingFileMeta?.type ?? "image/jpeg"}
        onCropped={(file) => {
          if (cropTarget) void handleUpload(file, cropTarget);
          setCropImageSrc(null);
        }}
      />
    </div>
  );
}
