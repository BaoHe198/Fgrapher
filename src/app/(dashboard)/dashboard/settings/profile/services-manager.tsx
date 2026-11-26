"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import type { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  SERVICE_HOLD_MINUTES,
  SERVICE_HOLDS,
  serviceHoldFor,
  serviceKindsForRole,
  type ServiceHold,
} from "@/lib/constants/service-matrix";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildMediaVariants } from "@/lib/media/variants";
import { cn, formatCurrency } from "@/lib/utils";

/** One of the provider's own photos, offered as a package's picture. */
export interface ServicePhoto {
  id: string;
  url: string;
  moderationStatus: string;
}

interface ServiceItem {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
  isActive: boolean;
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
  coverMediaId?: string | null;
}

interface ServiceDraft {
  kind: string;
  name: string;
  description: string;
  hold: ServiceHold;
  price: string;
  isActive: boolean;
  editedPhotoCount: string;
  deliveryDays: string;
  /** "" lets the page pick a portfolio photo, as it did before. */
  coverMediaId: string;
}

const EMPTY_DRAFT: ServiceDraft = {
  kind: "",
  name: "",
  description: "",
  hold: "HOUR",
  price: "",
  isActive: true,
  editedPhotoCount: "",
  deliveryDays: "",
  coverMediaId: "",
};

export function ServicesManager({
  profileId,
  role,
  initialServices,
  availableMedia = [],
}: {
  profileId: string;
  role: Role;
  initialServices: ServiceItem[];
  /** The provider's portfolio photos, to choose a package's picture from. */
  availableMedia?: ServicePhoto[];
}) {
  const t = useTranslations("dashboardSettings.profile.services");
  const serviceKindT = useTranslations("serviceKind");
  // A role may only offer what the matrix allows — the API enforces the same
  // rule, this just stops the provider picking something it will refuse.
  const allowedKinds = serviceKindsForRole(role);
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, kind: allowedKinds[0] ?? "" });
    setModalOpen(true);
  };

  const openEdit = (service: ServiceItem) => {
    setEditingId(service.id);
    setDraft({
      kind: service.kind,
      name: service.name,
      description: service.description ?? "",
      hold: serviceHoldFor(service.duration),
      price: String(service.price),
      isActive: service.isActive,
      editedPhotoCount:
        service.editedPhotoCount != null
          ? String(service.editedPhotoCount)
          : "",
      deliveryDays:
        service.deliveryDays != null ? String(service.deliveryDays) : "",
      // A photo deleted since it was chosen is simply no longer offered.
      coverMediaId: availableMedia.some((m) => m.id === service.coverMediaId)
        ? (service.coverMediaId ?? "")
        : "",
    });
    setModalOpen(true);
  };

  // "Edited photos" and "photos delivered after" were asked of every kind,
  // so a makeup artist, a model and a studio were asked how many photos
  // they would retouch (found 25/11/2026). Only a photo package has a photo
  // count; a video package still has a delivery time, worded for film.
  const delivers = {
    photos: draft.kind === "PHOTOGRAPHY",
    anything: draft.kind === "PHOTOGRAPHY" || draft.kind === "VIDEOGRAPHY",
  };

  const save = async () => {
    setIsSaving(true);
    const payload = {
      kind: draft.kind,
      name: draft.name,
      description: draft.description || undefined,
      // Always sent: the API's schema defaults a missing duration to one
      // hour, on an edit as well as on a create.
      duration: SERVICE_HOLD_MINUTES[draft.hold],
      price: Number(draft.price),
      isActive: draft.isActive,
      // Blank clears: the package card then simply leaves that line out.
      // So does a kind the field does not apply to (see `delivers` below).
      editedPhotoCount:
        delivers.photos && draft.editedPhotoCount
          ? Number(draft.editedPhotoCount)
          : null,
      deliveryDays:
        delivers.anything && draft.deliveryDays
          ? Number(draft.deliveryDays)
          : null,
      coverMediaId: draft.coverMediaId || null,
    };

    const res = editingId
      ? await fetch(`/api/services/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, profileId }),
        });

    const body = await res.json();
    setIsSaving(false);

    if (res.ok) {
      setServices((prev) =>
        editingId
          ? prev.map((s) => (s.id === editingId ? body.data : s))
          : [...prev, body.data],
      );
      setModalOpen(false);
    }
  };

  const photoOf = (service: ServiceItem) =>
    availableMedia.find((m) => m.id === service.coverMediaId) ?? null;
  const chosenPhoto =
    availableMedia.find((m) => m.id === draft.coverMediaId) ?? null;

  const remove = async (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/services/${id}`, { method: "DELETE" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
          {t("title")}
        </span>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="size-4" />
          {t("addService")}
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="text-body-sm text-text-secondary">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-3 rounded-[var(--fg-radius-sm)] border border-border-default p-3"
            >
              {photoOf(service) ? (
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken">
                  <Image
                    src={buildMediaVariants(photoOf(service)!.url).thumbnail}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-body-md font-semibold! text-text-primary">
                  {service.name} {!service.isActive ? t("inactive") : ""}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {serviceKindT(service.kind)} ·{" "}
                  {formatCurrency(service.price, service.currency)} ·{" "}
                  {t(`holdShort.${serviceHoldFor(service.duration)}`)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(service)}
                  aria-label={t("editServiceAria", { service: service.name })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(service.id)}
                  aria-label={t("deleteServiceAria", { service: service.name })}
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
              {editingId ? t("editService") : t("addServiceDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <NativeSelect
              label={t("kindLabel")}
              options={allowedKinds.map((kind) => ({
                value: kind,
                label: serviceKindT(kind),
              }))}
              value={draft.kind}
              onChange={(value) => setDraft({ ...draft, kind: value })}
            />
            <Input
              label={t("nameLabel")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="services-manager-field-1"
                className="text-body-sm font-semibold! text-text-primary"
              >
                {t("descriptionLabel")}
              </label>
              <Textarea
                id="services-manager-field-1"
                aria-label={t("descriptionLabel")}
                rows={6}
                className="min-h-36 text-body-md"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <NativeSelect
                label={t("holdLabel")}
                options={SERVICE_HOLDS.map((hold) => ({
                  value: hold,
                  label: t(`hold.${hold}`),
                }))}
                value={draft.hold}
                onChange={(value) =>
                  setDraft({ ...draft, hold: value as ServiceHold })
                }
              />
              <p className="text-meta text-text-tertiary">{t("holdHelper")}</p>
            </div>
            {delivers.anything ? (
              <div className="grid grid-cols-2 gap-3">
                {delivers.photos ? (
                  <Input
                    label={t("editedPhotosLabel")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draft.editedPhotoCount}
                    onChange={(e) =>
                      setDraft({ ...draft, editedPhotoCount: e.target.value })
                    }
                  />
                ) : null}
                <Input
                  label={
                    delivers.photos
                      ? t("deliveryDaysLabel")
                      : t("deliveryDaysVideoLabel")
                  }
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.deliveryDays}
                  onChange={(e) =>
                    setDraft({ ...draft, deliveryDays: e.target.value })
                  }
                />
              </div>
            ) : null}
            {/* The picture on this package's card. It used to be taken
                from the portfolio by position, so a wedding package could
                show a product shot (role walk-through, 25/11/2026). */}
            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm font-semibold! text-text-primary">
                {t("coverLabel")}
              </span>
              {availableMedia.length === 0 ? (
                <p className="text-body-sm text-text-tertiary">
                  {t("coverEmpty")}
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={t("coverLabel")}
                  className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.coverMediaId === ""}
                    onClick={() => setDraft({ ...draft, coverMediaId: "" })}
                    className={cn(
                      "focus-ring flex size-16 cursor-pointer items-center justify-center rounded-[var(--fg-radius-md)] border-2 px-1 text-center text-meta text-text-secondary",
                      draft.coverMediaId === ""
                        ? "border-brand-primary"
                        : "border-dashed border-border-default",
                    )}
                  >
                    {t("coverAuto")}
                  </button>
                  {availableMedia.map((m, index) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={draft.coverMediaId === m.id}
                      aria-label={t("coverNumbered", { index: index + 1 })}
                      onClick={() => setDraft({ ...draft, coverMediaId: m.id })}
                      className={cn(
                        "focus-ring relative size-16 cursor-pointer overflow-hidden rounded-[var(--fg-radius-md)] border-2 bg-bg-sunken",
                        draft.coverMediaId === m.id
                          ? "border-brand-primary"
                          : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      <Image
                        src={buildMediaVariants(m.url).thumbnail}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-meta text-text-tertiary">
                {chosenPhoto && chosenPhoto.moderationStatus !== "APPROVED"
                  ? t("coverPending")
                  : t("coverHelper")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CurrencyInput
                label={t("priceLabel")}
                value={draft.price}
                onChange={(digits) => setDraft({ ...draft, price: digits })}
              />
              <Switch
                label={t("activeLabel")}
                checked={draft.isActive}
                onChange={(value) => setDraft({ ...draft, isActive: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={isSaving || !draft.kind || !draft.name || !draft.price}
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
