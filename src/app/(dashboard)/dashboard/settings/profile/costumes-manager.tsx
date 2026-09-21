"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COSTUME_CATEGORIES } from "@/lib/validations/costume";
import { formatCurrency } from "@/lib/utils";

export interface CostumeMedia {
  id: string;
  url: string;
  title?: string | null;
  moderationStatus: string;
}

export interface CostumeItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  rentalPricePerDay: number;
  depositAmount: number | null;
  size: string | null;
  color: string | null;
  isActive: boolean;
  media: { id: string; url: string; moderationStatus: string } | null;
}

interface CostumeDraft {
  name: string;
  description: string;
  category: string;
  rentalPricePerDay: string;
  depositAmount: string;
  size: string;
  color: string;
  mediaId: string;
  isActive: boolean;
}

const EMPTY_DRAFT: CostumeDraft = {
  name: "",
  description: "",
  category: "",
  rentalPricePerDay: "",
  depositAmount: "",
  size: "",
  color: "",
  mediaId: "",
  isActive: true,
};

export function CostumesManager({
  profileId,
  initialCostumes,
  availableMedia,
}: {
  profileId: string;
  initialCostumes: CostumeItem[];
  availableMedia: CostumeMedia[];
}) {
  const t = useTranslations("dashboardSettings.profile.costumes");
  const categoryT = useTranslations("profileCategory");
  const [items, setItems] = useState<CostumeItem[]>(initialCostumes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CostumeDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CostumeItem) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description ?? "",
      category: item.category ?? "",
      rentalPricePerDay: String(item.rentalPricePerDay),
      depositAmount:
        item.depositAmount != null ? String(item.depositAmount) : "",
      size: item.size ?? "",
      color: item.color ?? "",
      mediaId: item.media?.id ?? "",
      isActive: item.isActive,
    });
    setError(null);
    setModalOpen(true);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      category: draft.category || null,
      rentalPricePerDay: Number(draft.rentalPricePerDay),
      depositAmount: draft.depositAmount ? Number(draft.depositAmount) : null,
      size: draft.size || undefined,
      color: draft.color || undefined,
      mediaId: draft.mediaId || null,
      isActive: draft.isActive,
    };

    const res = editingId
      ? await fetch(`/api/costumes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/costumes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, profileId }),
        });

    const body = await res.json();
    setIsSaving(false);

    if (!res.ok) {
      setError(body.message ?? t("saveFailed"));
      return;
    }

    const media = availableMedia.find((m) => m.id === draft.mediaId) ?? null;
    const saved: CostumeItem = {
      ...body.data,
      media: media
        ? {
            id: media.id,
            url: media.url,
            moderationStatus: media.moderationStatus,
          }
        : null,
    };
    setItems((prev) =>
      editingId
        ? prev.map((i) => (i.id === editingId ? saved : i))
        : [...prev, saved],
    );
    setModalOpen(false);
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/costumes/${id}`, { method: "DELETE" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("title")}
        </span>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      <p className="text-body-sm text-text-tertiary">{t("helper")}</p>

      {items.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[var(--fg-radius-sm)] border border-border-default p-3"
            >
              {item.media ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--fg-radius-sm)]">
                  <Image
                    src={item.media.url}
                    alt={item.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-semibold! text-text-primary">
                  {item.name} {!item.isActive ? t("inactive") : ""}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {t("perDay", {
                    price: formatCurrency(item.rentalPricePerDay),
                  })}
                  {item.depositAmount
                    ? ` · ${t("deposit", { amount: formatCurrency(item.depositAmount) })}`
                    : ""}
                </p>
                {item.media && item.media.moderationStatus !== "APPROVED" ? (
                  <p className="text-body-sm text-text-tertiary">
                    {t("photoPending")}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(item)}
                  aria-label={t("editAria", { name: item.name })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                  aria-label={t("deleteAria", { name: item.name })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("editTitle") : t("addTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label={t("nameLabel")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <NativeSelect
              label={t("categoryLabel")}
              options={[
                { value: "", label: t("categoryNone") },
                ...COSTUME_CATEGORIES.map((c) => ({
                  value: c,
                  label: categoryT(c),
                })),
              ]}
              value={draft.category}
              onChange={(value) => setDraft({ ...draft, category: value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <CurrencyInput
                label={t("priceLabel")}
                value={draft.rentalPricePerDay}
                onChange={(digits) =>
                  setDraft({ ...draft, rentalPricePerDay: digits })
                }
              />
              <CurrencyInput
                label={t("depositLabel")}
                value={draft.depositAmount}
                onChange={(digits) =>
                  setDraft({ ...draft, depositAmount: digits })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("sizeLabel")}
                value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })}
              />
              <Input
                label={t("colorLabel")}
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </div>
            <NativeSelect
              label={t("photoLabel")}
              options={[
                { value: "", label: t("photoNone") },
                ...availableMedia.map((m, index) => ({
                  value: m.id,
                  label: m.title ?? t("photoNumbered", { index: index + 1 }),
                })),
              ]}
              value={draft.mediaId}
              onChange={(value) => setDraft({ ...draft, mediaId: value })}
            />
            <p className="text-body-sm text-text-tertiary">
              {t("photoHelper")}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-body-sm font-semibold! text-text-primary">
                {t("descriptionLabel")}
              </label>
              <Textarea
                aria-label={t("descriptionLabel")}
                rows={5}
                className="min-h-28 text-body-md"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            <Switch
              label={t("activeLabel")}
              checked={draft.isActive}
              onChange={(value) => setDraft({ ...draft, isActive: value })}
            />
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={isSaving || !draft.name || !draft.rentalPricePerDay}
              onClick={save}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
