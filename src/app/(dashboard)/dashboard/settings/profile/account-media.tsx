"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef } from "react";

import { ImageCropDialog } from "@/components/profile/image-crop-dialog";
import { useAccountMediaUpload } from "@/hooks/use-account-media-upload";
import { cn } from "@/lib/utils";

export function AccountMedia({
  initialAvatar,
  initialCoverImage,
}: {
  initialAvatar: string | null;
  initialCoverImage: string | null;
}) {
  const t = useTranslations("dashboardSettings.profile.media");
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const {
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
  } = useAccountMediaUpload({ initialAvatar, initialCoverImage });

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
          aria-label={t("coverButton")}
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
          aria-label={t("coverButton")}
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
          {/* The control used to be opacity-0 until hover. With no photo
              yet that left a plain grey circle with nothing saying it could
              be clicked — while "add a profile photo" is the first thing the
              dashboard asks for — and on a phone, with no hover at all, the
              control never appeared. Empty: always shown. With a photo: on
              hover, on keyboard focus, and always on touch screens. */}
          <button
            type="button"
            onClick={() => avatarInput.current?.click()}
            aria-label={t("avatarButton")}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity",
              avatar
                ? "bg-black/40 text-white opacity-0 hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {uploading === "avatar" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {avatar ? null : (
              <span className="text-body-sm">{t("avatarButton")}</span>
            )}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t("avatarButton")}
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
          if (!open) closeCrop();
        }}
        imageSrc={cropImageSrc}
        aspect={cropTarget === "avatar" ? 1 : 3}
        fileName={pendingFileMeta?.name ?? "image"}
        mimeType={pendingFileMeta?.type ?? "image/jpeg"}
        onCropped={onCropped}
      />
    </div>
  );
}
