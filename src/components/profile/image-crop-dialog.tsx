"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCroppedImageFile } from "@/lib/image-crop";

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  aspect: number;
  fileName: string;
  mimeType: string;
  onCropped: (file: File) => void;
}

// Prompt G2, VIỆC 2 — "Cho cắt ảnh trước khi lưu (tỉ lệ cố định: avatar
// 1:1, bìa 3:1) để tránh ảnh méo hoặc lệch khung". Shared by both the
// avatar and cover-photo pickers in account-media.tsx — only `aspect`
// differs between the two call sites.
export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  aspect,
  fileName,
  mimeType,
  onCropped,
}: ImageCropDialogProps) {
  const t = useTranslations("dashboardSettings.profile.media");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const file = await getCroppedImageFile(
        imageSrc,
        croppedAreaPixels,
        fileName,
        mimeType,
      );
      onCropped(file);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("cropTitle")}</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-[var(--fg-radius-md)] bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) =>
                setCroppedAreaPixels(areaPixels)
              }
            />
          ) : null}
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label={t("zoomAria")}
          className="w-full"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cropCancel")}
          </Button>
          <Button variant="accent" disabled={isSaving} onClick={onConfirm}>
            {t("cropConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
