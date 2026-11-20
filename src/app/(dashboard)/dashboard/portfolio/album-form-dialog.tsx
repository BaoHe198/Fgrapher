"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  AlbumPlacePicker,
  type PickedPlace,
} from "@/components/places/album-place-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateField } from "@/components/ui/date-field";
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

// Prompt G3, VIỆC 2 — "Form album: tiêu đề, mô tả (tùy chọn), thể loại
// (bắt buộc, lọc theo vai trò...), ngày chụp (tùy chọn)". The title was
// required by that prompt; the owner made it optional on 19/11/2026 — left
// blank, the album is named after its category ("Album Chân dung"), which
// is what most providers typed anyway. Reused as-is (not extended) by the
// upload modal's "create album inline" step — see upload-media-modal.tsx.
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
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categoryOptions = CATEGORIES_BY_ROLE[role] ?? [];

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setShootDate("");
    setPlace(null);
    setError(null);
  };

  const onSubmit = async () => {
    setError(null);
    if (!category) {
      setError(t("categoryRequired"));
      return;
    }
    // A single character is more likely a slip than a title.
    if (title.trim().length === 1) {
      setError(t("titleRequired"));
      return;
    }

    setIsSaving(true);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        // Blank is fine: the API names the album after its category.
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category,
        shootDate: shootDate || undefined,
        placeId: place?.id,
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
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="album-form-dialog-field-1"
              className="text-body-sm font-semibold! text-text-primary"
            >
              {t("descriptionLabel")}
            </label>
            <Textarea
              id="album-form-dialog-field-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <NativeSelect
            label={t("categoryLabel")}
            value={category}
            onChange={(value) => {
              setCategory(value);
              // "Choose a category" must not outlive the choice.
              setError(null);
            }}
            options={[
              { value: "", label: t("categoryPlaceholder") },
              ...categoryOptions.map((c) => ({
                value: c,
                label: categoryT(c),
              })),
            ]}
          />
          <DateField
            label={t("shootDateLabel")}
            value={shootDate}
            onChange={setShootDate}
          />
          <AlbumPlacePicker value={place} onChange={setPlace} />
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
