"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { CATEGORIES_BY_ROLE } from "@/lib/constants";

interface CreatedAlbum {
  id: string;
  title: string;
  category: ProfileCategory | null;
  shootDate: string | null;
}

interface AlbumFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  role: Role;
  onCreated: (album: CreatedAlbum) => void;
}

// Prompt G3, VIỆC 2 — "Form album: tiêu đề (bắt buộc), mô tả (tùy chọn),
// thể loại (bắt buộc, lọc theo vai trò...), ngày chụp (tùy chọn)". Reused
// as-is (not extended) by the upload modal's new "create album inline"
// step — see upload-media-modal.tsx.
export function AlbumFormDialog({
  open,
  onOpenChange,
  profileId,
  role,
  onCreated,
}: AlbumFormDialogProps) {
  const t = useTranslations("dashboardCore.albums.form");
  const categoryT = useTranslations("profileCategory");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categoryOptions = CATEGORIES_BY_ROLE[role] ?? [];

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setShootDate("");
    setError(null);
  };

  const onSubmit = async () => {
    setError(null);
    if (title.trim().length < 2) {
      setError(t("titleRequired"));
      return;
    }
    if (!category) {
      setError(t("categoryRequired"));
      return;
    }

    setIsSaving(true);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        shootDate: shootDate || undefined,
      }),
    });
    const body = await res.json();
    setIsSaving(false);

    if (!res.ok) {
      setError(body.message ?? t("createFailed"));
      return;
    }

    toast.add({ title: t("createdToast"), type: "success" });
    onCreated(body.data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <Input
            label={t("titleLabel")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-body-sm font-semibold text-text-primary">
              {t("descriptionLabel")}
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <NativeSelect
            label={t("categoryLabel")}
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: t("categoryPlaceholder") },
              ...categoryOptions.map((c) => ({
                value: c,
                label: categoryT(c),
              })),
            ]}
          />
          <Input
            label={t("shootDateLabel")}
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
          />
          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="accent" disabled={isSaving} onClick={onSubmit}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
