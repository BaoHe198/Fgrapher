"use client";

import { Loader2, Maximize2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { ImageCropDialog } from "@/components/profile/image-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccountMediaUpload } from "@/hooks/use-account-media-upload";

// The owner-editing counterpart to page.tsx's cover/avatar markup — kept
// as two separate exports (not one wrapping component) because the cover
// banner and the avatar circle sit in two different places in page.tsx's
// DOM (the cover is full-bleed above the max-w container; the avatar sits
// inside the name/badges row) with a lot of unrelated content between
// them. Each renders the *exact same visual markup* page.tsx already has
// for the read-only case, adding a hover-edit affordance + crop dialog
// only when isOwnProfile — a visitor sees pixel-identical output either
// way. Each keeps its own useAccountMediaUpload instance since an avatar
// edit and a cover edit are independent actions with no shared state to
// coordinate.

export function ProfileCover({
  coverImage,
  fallbackImage,
  isOwnProfile,
  variant = "banner",
  name,
}: {
  /**
   * "hero" (wave 2 profile): fills its darkroom parent edge to edge, with a
   * "Xem nguyên khung" button - the cover is the one place the photo is
   * cropped, so the full frame is always one press away.
   */
  variant?: "banner" | "hero";
  /** The person's name, for the full-frame viewer's caption. */
  name?: string;
  coverImage: string | null;
  // A provider's own best approved photo, used when they haven't set a
  // cover. A photographer's page whose largest element is a brand
  // gradient is advertising the platform instead of their work — their
  // portfolio is the one thing a visitor came to see.
  fallbackImage: string | null;
  isOwnProfile: boolean;
}) {
  const t = useTranslations("publicPages.profile.hero");
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    coverImage: liveCoverImage,
    error,
    uploading,
    cropTarget,
    cropImageSrc,
    pendingFileMeta,
    onFileSelected,
    closeCrop,
    onCropped,
  } = useAccountMediaUpload({
    initialAvatar: null,
    initialCoverImage: coverImage,
  });

  const chosenCover = (isOwnProfile ? liveCoverImage : coverImage) ?? null;
  const displayCover = chosenCover ?? fallbackImage;
  // A real photo behind the avatar and action buttons needs a scrim to
  // keep them legible; the brand gradient was already dark enough not to.
  // Only when we fell back — an owner-chosen cover is their composition
  // to frame, so it is left untouched.
  const needsScrim = !chosenCover && Boolean(fallbackImage);
  const hero = variant === "hero";
  const [fullFrame, setFullFrame] = useState(false);

  return (
    <div
      className={
        hero
          ? "absolute inset-0 bg-dr-bg"
          : "relative h-[180px] w-full bg-bg-sunken sm:h-[260px]"
      }
    >
      {displayCover ? (
        <>
          <Image
            src={displayCover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            unoptimized={isOwnProfile}
          />
          {needsScrim && !hero ? (
            <div className="absolute inset-0 bg-gradient-to-t from-scrim via-transparent to-transparent opacity-70" />
          ) : null}
          {hero ? (
            <>
              <button
                type="button"
                onClick={() => setFullFrame(true)}
                className="focus-ring absolute top-4 right-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-dr-line-2 bg-[var(--dr-scrim)] px-3 py-1.5 font-mono text-meta tracking-[0.12em] text-dr-text uppercase sm:right-8"
              >
                <Maximize2 aria-hidden className="size-3.5" />
                {t("fullFrame")}
              </button>
              {fullFrame ? (
                <MediaLightbox
                  items={[{ url: displayCover, title: name, type: "IMAGE" }]}
                  index={0}
                  onClose={() => setFullFrame(false)}
                  onIndexChange={() => {}}
                  title={name}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : hero ? null : (
        <div
          className="size-full"
          style={{
            background:
              "linear-gradient(135deg, var(--green-900), var(--green-500) 60%, var(--gold-300))",
          }}
        />
      )}

      {isOwnProfile ? (
        <>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label={t("editCoverAria")}
            className={
              hero
                ? "focus-ring absolute top-14 right-5 z-10 flex items-center gap-1.5 rounded-full border border-dr-line-2 bg-[var(--dr-scrim)] px-3 py-1.5 text-body-sm text-dr-text sm:right-8"
                : "absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-body-sm text-white"
            }
          >
            {uploading === "cover" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {t("editCoverLabel")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelected(file, "cover");
              e.target.value = "";
            }}
          />
          {error ? (
            <p className="absolute inset-x-3 top-2 rounded-[var(--fg-radius-sm)] bg-black/60 px-2 py-1 text-body-sm text-white">
              {error}
            </p>
          ) : null}
          <ImageCropDialog
            open={cropTarget !== null}
            onOpenChange={(open) => {
              if (!open) closeCrop();
            }}
            imageSrc={cropImageSrc}
            aspect={3}
            fileName={pendingFileMeta?.name ?? "cover.jpg"}
            mimeType={pendingFileMeta?.type ?? "image/jpeg"}
            onCropped={onCropped}
          />
        </>
      ) : null}
    </div>
  );
}

export function ProfileAvatar({
  avatar,
  displayName,
  isOwnProfile,
  compact = false,
}: {
  /** Inline in the darkroom hero's meta row rather than overlapping a banner. */
  compact?: boolean;
  avatar: string | null;
  displayName: string;
  isOwnProfile: boolean;
}) {
  const t = useTranslations("publicPages.profile.hero");
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    avatar: liveAvatar,
    error,
    uploading,
    cropTarget,
    cropImageSrc,
    pendingFileMeta,
    onFileSelected,
    closeCrop,
    onCropped,
  } = useAccountMediaUpload({
    initialAvatar: avatar,
    initialCoverImage: null,
  });

  const displayAvatar = isOwnProfile ? liveAvatar : avatar;

  return (
    <div className="flex flex-col gap-1.5">
      <Avatar
        className={
          compact
            ? "size-12 shrink-0 border border-dr-line-2 bg-dr-surface"
            : "-mt-14 size-24 shrink-0 border-4 border-bg-page bg-bg-page sm:-mt-20 sm:size-[132px]"
        }
      >
        {displayAvatar ? (
          <AvatarImage src={displayAvatar} alt={displayName} />
        ) : null}
        <AvatarFallback
          className={
            compact ? "text-heading-sm" : "text-heading-lg sm:text-display-md"
          }
        >
          {displayName[0]?.toUpperCase()}
        </AvatarFallback>

        {isOwnProfile ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label={t("editAvatarAria")}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
          >
            {uploading === "avatar" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </button>
        ) : null}
      </Avatar>
      {isOwnProfile ? (
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file, "avatar");
            e.target.value = "";
          }}
        />
      ) : null}
      {isOwnProfile && error ? (
        <p className="max-w-[132px] text-body-sm text-danger">{error}</p>
      ) : null}
      {isOwnProfile ? (
        <ImageCropDialog
          open={cropTarget !== null}
          onOpenChange={(open) => {
            if (!open) closeCrop();
          }}
          imageSrc={cropImageSrc}
          aspect={1}
          fileName={pendingFileMeta?.name ?? "avatar.jpg"}
          mimeType={pendingFileMeta?.type ?? "image/jpeg"}
          onCropped={onCropped}
        />
      ) : null}
    </div>
  );
}
