"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

// Prompt F7, VIỆC 4 — "Tạo mã QR (hữu ích để provider in ra hoặc để trong
// bio)". Generated client-side (qrcode's toDataURL), not via a third-party
// image-generation API — self-contained, no runtime dependency on an
// external service, no data leaving the browser.
export function QrCodeDialog({ open, onOpenChange, url }: QrCodeDialogProps) {
  const t = useTranslations("publicPages.profile.shareMenu");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 320, margin: 2 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("qrCodeTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {dataUrl ? (
            // client-generated data: URL, not an optimizable remote image
            <img
              src={dataUrl}
              alt={t("qrCodeAlt")}
              width={320}
              height={320}
              className="rounded-[var(--fg-radius-md)]"
            />
          ) : (
            <div className="size-[320px] animate-pulse rounded-[var(--fg-radius-md)] bg-bg-sunken" />
          )}
          <p className="max-w-[280px] text-center text-body-sm text-text-secondary">
            {t("qrCodeHint")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
