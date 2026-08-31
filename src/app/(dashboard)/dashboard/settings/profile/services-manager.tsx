"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
  isActive: boolean;
}

interface ServiceDraft {
  name: string;
  description: string;
  duration: string;
  price: string;
  isActive: boolean;
}

const EMPTY_DRAFT: ServiceDraft = {
  name: "",
  description: "",
  duration: "60",
  price: "",
  isActive: true,
};

export function ServicesManager({
  profileId,
  initialServices,
}: {
  profileId: string;
  initialServices: ServiceItem[];
}) {
  const t = useTranslations("dashboardSettings.profile.services");
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  };

  const openEdit = (service: ServiceItem) => {
    setEditingId(service.id);
    setDraft({
      name: service.name,
      description: service.description ?? "",
      duration: String(service.duration),
      price: String(service.price),
      isActive: service.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setIsSaving(true);
    const payload = {
      name: draft.name,
      description: draft.description || undefined,
      duration: Number(draft.duration),
      price: Number(draft.price),
      isActive: draft.isActive,
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

  const remove = async (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/services/${id}`, { method: "DELETE" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
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
              className="flex items-center justify-between rounded-[var(--fg-radius-sm)] border border-border-default p-3"
            >
              <div>
                <p className="text-body-md font-semibold! text-text-primary">
                  {service.name} {!service.isActive ? t("inactive") : ""}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {formatCurrency(service.price, service.currency)} ·{" "}
                  {service.duration} {t("minutesSuffix")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(service)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(service.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("editService") : t("addServiceDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label={t("nameLabel")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-body-sm font-semibold! text-text-primary">
                {t("descriptionLabel")}
              </label>
              <textarea
                className="min-h-20 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("durationLabel")}
                type="number"
                value={draft.duration}
                onChange={(e) =>
                  setDraft({ ...draft, duration: e.target.value })
                }
              />
              <CurrencyInput
                label={t("priceLabel")}
                value={draft.price}
                onChange={(digits) => setDraft({ ...draft, price: digits })}
              />
            </div>
            <Switch
              label={t("activeLabel")}
              checked={draft.isActive}
              onChange={(value) => setDraft({ ...draft, isActive: value })}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={isSaving || !draft.name || !draft.price}
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
