"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

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
import { CATEGORIES_BY_ROLE } from "@/lib/constants";

interface AlbumEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  album: {
    id: string;
    title: string;
    description: string | null;
    category: ProfileCategory | null;
  } | null;
  onSaved: (album: {
    id: string;
    title: string;
    description: string | null;
    category: ProfileCategory | null;
  }) => void;
}

// Inline counterpart to dashboard/portfolio/[albumId]/album-detail.tsx's
// meta-edit block — same three fields (title/description/category), same
// PATCH /api/albums/[id] shape, reusing that page's existing
// dashboardCore.albums.detail i18n keys. Deliberately doesn't cover
// shootDate or per-photo management (upload/delete/set-cover/trash) —
// those stay on the full dashboard page, linked to below.
export function AlbumEditDialog({
  open,
  onOpenChange,
  role,
  album,
  onSaved,
}: AlbumEditDialogProps) {
  const t = useTranslations("dashboardCore.albums.detail");
  const dialogT = useTranslations("publicPages.profile.albumEditDialog");
  const categoryT = useTranslations("profileCategory");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProfileCategory | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = CATEGORIES_BY_ROLE[role] ?? [];

  useEffect(() => {
    if (!album) return;
    startTransition(() => {
      setTitle(album.title);
      setDescription(album.description ?? "");
      setCategory(album.category ?? "");
      setError(null);
    });
  }, [album]);

  const onSubmit = async () => {
    if (!album) return;
    setError(null);
    setIsSaving(true);
    const res = await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        category: category || undefined,
      }),
    });
    const body = await res.json();
    setIsSaving(false);

    if (!res.ok) {
      setError(body.message ?? t("saveFailed"));
      return;
    }

    onSaved({
      id: album.id,
      title,
      description: description || null,
      category: (category || null) as ProfileCategory | null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogT("title")}</DialogTitle>
        </DialogHeader>

        {album ? (
          <div className="flex flex-col gap-3.5">
            <Input
              label={t("titleLabel")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-body-sm font-semibold! text-text-primary">
                {t("descriptionLabel")}
              </label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <NativeSelect
              label={t("categoryLabel")}
              value={category}
              onChange={(value) => setCategory(value as ProfileCategory | "")}
              options={[
                { value: "", label: t("categoryPlaceholder") },
                ...categoryOptions.map((c) => ({
                  value: c,
                  label: categoryT(c),
                })),
              ]}
            />
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
            <Link
              href={`/dashboard/portfolio/${album.id}`}
              className="text-body-sm font-semibold! text-text-link hover:underline"
            >
              {dialogT("managePhotosLink")}
            </Link>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="accent" disabled={isSaving} onClick={onSubmit}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
