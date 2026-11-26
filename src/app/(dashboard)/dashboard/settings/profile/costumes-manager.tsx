"use client";

import { Check, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { UploadMediaModal } from "@/components/modals/upload-media-modal";
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
import {
  COSTUME_CATEGORIES,
  MAX_COSTUME_EXTRA_PHOTOS,
} from "@/lib/validations/costume";
import { cn, formatCurrency } from "@/lib/utils";

export interface CostumeMedia {
  id: string;
  url: string;
  type?: "IMAGE" | "VIDEO";
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
  /** Further photos of the outfit, after the main one. */
  gallery?: { id: string; url: string; moderationStatus: string }[];
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
  galleryIds: string[];
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
  galleryIds: [],
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
  const [media, setMedia] = useState<CostumeMedia[]>(
    availableMedia.filter((item) => item.type !== "VIDEO"),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CostumeDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    // Start on the first uploaded photo no outfit uses yet: the usual order
    // is "upload photos, then add the outfit", and an outfit saved without
    // its photo shows as an empty tile on the public profile.
    const used = new Set(items.map((item) => item.media?.id));
    setDraft({
      ...EMPTY_DRAFT,
      mediaId: media.find((m) => !used.has(m.id))?.id ?? "",
    });
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
      galleryIds: (item.gallery ?? []).map((photo) => photo.id),
      isActive: item.isActive,
    });
    setError(null);
    setModalOpen(true);
  };

  // Further photos: never the main one, and none without a main photo.
  const extraIds = draft.mediaId
    ? draft.galleryIds.filter((id) => id !== draft.mediaId)
    : [];
  const toggleExtra = (id: string) =>
    setDraft((current) => ({
      ...current,
      galleryIds: current.galleryIds.includes(id)
        ? current.galleryIds.filter((other) => other !== id)
        : current.galleryIds.filter((other) => other !== current.mediaId)
              .length >= MAX_COSTUME_EXTRA_PHOTOS
          ? current.galleryIds
          : [...current.galleryIds, id],
    }));

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
      galleryMediaIds: extraIds,
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

    const selectedMedia = media.find((m) => m.id === draft.mediaId) ?? null;
    const saved: CostumeItem = {
      ...body.data,
      media: selectedMedia
        ? {
            id: selectedMedia.id,
            url: selectedMedia.url,
            moderationStatus: selectedMedia.moderationStatus,
          }
        : null,
      gallery: media
        .filter((m) => extraIds.includes(m.id))
        .map((m) => ({
          id: m.id,
          url: m.url,
          moderationStatus: m.moderationStatus,
        })),
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
    // The sidebar's "Trang phục của tôi" link lands here. A costume shop has
    // no Chợ F listings page of its own (outfits are a profile catalogue,
    // not products), so without an anchor the entry point to this was a
    // section buried in the profile form — QA-06 read that as the role
    // having no way to post anything at all.
    <div id="costumes" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
          {t("title")}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setUploadOpen(true)}
          >
            <ImagePlus className="size-4" />
            {t("uploadPhoto")}
          </Button>
          <Button size="sm" variant="secondary" onClick={openCreate}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        </div>
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
                <p className="line-clamp-2 text-body-md font-semibold! text-text-primary">
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
                {item.gallery && item.gallery.length > 0 ? (
                  <p className="text-body-sm text-text-tertiary">
                    {t("extraCount", { count: item.gallery.length })}
                  </p>
                ) : null}
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
            {/* Thumbnails, not a list of "Ảnh số 1, Ảnh số 2": the shop has
                to see which photo it is attaching (19/11/2026). */}
            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm font-semibold! text-text-primary">
                {t("photoLabel")}
              </span>
              {media.length === 0 ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-body-sm text-warning">{t("photoEmpty")}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setUploadOpen(true)}
                  >
                    <ImagePlus className="size-4" />
                    {t("uploadPhoto")}
                  </Button>
                </div>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={t("photoLabel")}
                  className="flex flex-wrap gap-2"
                >
                  {media.map((m, index) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={draft.mediaId === m.id}
                      aria-label={
                        m.title ?? t("photoNumbered", { index: index + 1 })
                      }
                      onClick={() => setDraft({ ...draft, mediaId: m.id })}
                      className={cn(
                        "focus-ring relative size-16 cursor-pointer overflow-hidden rounded-[var(--fg-radius-md)] border-2 bg-bg-sunken",
                        draft.mediaId === m.id
                          ? "border-brand-primary"
                          : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      <Image
                        src={m.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.mediaId === ""}
                    onClick={() => setDraft({ ...draft, mediaId: "" })}
                    className={cn(
                      "focus-ring flex size-16 cursor-pointer items-center justify-center rounded-[var(--fg-radius-md)] border-2 px-1 text-center text-meta text-text-secondary",
                      draft.mediaId === ""
                        ? "border-brand-primary"
                        : "border-dashed border-border-default",
                    )}
                  >
                    {t("photoNone")}
                  </button>
                  {/* Upload without leaving the outfit: it used to mean
                      closing this box, uploading in another, and coming
                      back to pick the photo. The new photo is selected. */}
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    aria-label={t("uploadPhoto")}
                    className="focus-ring flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--fg-radius-md)] border-2 border-dashed border-border-default text-meta text-text-secondary hover:border-brand-primary"
                  >
                    <ImagePlus aria-hidden className="size-4" />
                    {t("photoUploadShort")}
                  </button>
                </div>
              )}
              <p className="text-body-sm text-text-tertiary">
                {t("photoHelper")}
              </p>
            </div>
            {/* Back, detail, another angle: what a customer asks to see
                before renting. One photo per outfit was all there was. */}
            {draft.mediaId && media.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-body-sm font-semibold! text-text-primary">
                  {t("extraLabel", {
                    count: extraIds.length,
                    max: MAX_COSTUME_EXTRA_PHOTOS,
                  })}
                </span>
                <div
                  role="group"
                  aria-label={t("extraLabel", {
                    count: extraIds.length,
                    max: MAX_COSTUME_EXTRA_PHOTOS,
                  })}
                  className="flex flex-wrap gap-2"
                >
                  {media
                    .filter((m) => m.id !== draft.mediaId)
                    .map((m, index) => {
                      const chosen = extraIds.includes(m.id);
                      const full =
                        !chosen && extraIds.length >= MAX_COSTUME_EXTRA_PHOTOS;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={chosen}
                          disabled={full}
                          aria-label={
                            m.title ?? t("photoNumbered", { index: index + 1 })
                          }
                          onClick={() => toggleExtra(m.id)}
                          className={cn(
                            "focus-ring relative size-16 cursor-pointer overflow-hidden rounded-[var(--fg-radius-md)] border-2 bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-30",
                            chosen
                              ? "border-brand-primary"
                              : "border-transparent opacity-70 hover:opacity-100",
                          )}
                        >
                          <Image
                            src={m.url}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                          {chosen ? (
                            <span className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-brand-primary text-text-on-brand">
                              <Check aria-hidden className="size-3.5" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
                <p className="text-body-sm text-text-tertiary">
                  {t("extraHelper")}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="costumes-manager-field-1"
                className="text-body-sm font-semibold! text-text-primary"
              >
                {t("descriptionLabel")}
              </label>
              <Textarea
                id="costumes-manager-field-1"
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
            {!draft.name || !draft.rentalPricePerDay ? (
              <p className="text-body-sm text-text-tertiary">
                {t("missingHint")}
              </p>
            ) : null}
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

      <UploadMediaModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        profileId={profileId}
        role="COSTUME_SHOP"
        allowStandalone
        imageOnly
        onUploaded={(uploaded) => {
          setMedia((current) => [
            ...current,
            ...uploaded.map((item) => ({
              id: item.id,
              url: item.url,
              type: item.type,
              title: item.title,
              moderationStatus: item.moderationStatus,
            })),
          ]);
          // Uploaded from inside the outfit box: these photos are meant for
          // this outfit. The first becomes the main photo only if there is
          // none yet; an outfit that already has an approved main photo
          // keeps it (a new upload waits for review, and swapping it in
          // would take the outfit off the public page until then). The
          // rest are added as further photos, up to the limit.
          if (modalOpen && uploaded.length > 0) {
            setDraft((current) => {
              const ids = uploaded.map((item) => item.id);
              const mediaId = current.mediaId || ids[0];
              const extras = [
                ...current.galleryIds,
                ...ids.filter((id) => id !== mediaId),
              ].filter((id) => id !== mediaId);
              return {
                ...current,
                mediaId,
                galleryIds: extras.slice(0, MAX_COSTUME_EXTRA_PHOTOS),
              };
            });
          }
        }}
      />
    </div>
  );
}
