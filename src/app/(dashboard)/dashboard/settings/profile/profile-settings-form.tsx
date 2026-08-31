"use client";

import type {
  ExperienceLevel,
  ProfileCategory,
  Role,
  VerificationStatus,
} from "@prisma/client";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { CATEGORIES_BY_ROLE, EXPERIENCE_LEVELS } from "@/lib/constants";
import { AMENITY_OPTIONS } from "@/lib/validations/profile";

import { ServicesManager } from "./services-manager";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
  isActive: boolean;
}

interface ProvinceOption {
  id: string;
  code: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
  provinceId: string;
}

interface ProfileFormValues {
  displayName: string;
  description: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  priceMin: string;
  priceMax: string;
  categories: ProfileCategory[];
  address: string;
  area: string;
  amenities: string[];
  shopName: string;
  height: string;
  measurements: string;
  hairColor: string;
  eyeColor: string;
  shoeSize: string;
  experienceLevel: ExperienceLevel | "";
  travelWilling: boolean;
  agencyRepresented: boolean;
  agencyName: string;
  hideExactLocation: boolean;
  requireDepositBeforeContact: boolean;
  provinceId: string;
  wardId: string;
  servesNationwide: boolean;
}

function toFormValues(
  profile: Record<string, unknown> | null,
): ProfileFormValues {
  return {
    displayName: (profile?.displayName as string) ?? "",
    description: (profile?.description as string) ?? "",
    website: (profile?.website as string) ?? "",
    instagram: (profile?.instagram as string) ?? "",
    facebook: (profile?.facebook as string) ?? "",
    tiktok: (profile?.tiktok as string) ?? "",
    priceMin: profile?.priceMin != null ? String(profile.priceMin) : "",
    priceMax: profile?.priceMax != null ? String(profile.priceMax) : "",
    categories: (profile?.categories as ProfileCategory[]) ?? [],
    address: (profile?.address as string) ?? "",
    area: profile?.area != null ? String(profile.area) : "",
    amenities: (profile?.amenities as string[]) ?? [],
    shopName: (profile?.shopName as string) ?? "",
    height: profile?.height != null ? String(profile.height) : "",
    measurements: (profile?.measurements as string) ?? "",
    hairColor: (profile?.hairColor as string) ?? "",
    eyeColor: (profile?.eyeColor as string) ?? "",
    shoeSize: (profile?.shoeSize as string) ?? "",
    experienceLevel: (profile?.experienceLevel as ExperienceLevel) ?? "",
    travelWilling: (profile?.travelWilling as boolean) ?? false,
    agencyRepresented: (profile?.agencyRepresented as boolean) ?? false,
    agencyName: (profile?.agencyName as string) ?? "",
    hideExactLocation: (profile?.hideExactLocation as boolean) ?? false,
    requireDepositBeforeContact:
      (profile?.requireDepositBeforeContact as boolean) ?? false,
    provinceId: (profile?.provinceId as string) ?? "",
    wardId: (profile?.wardId as string) ?? "",
    servesNationwide: (profile?.servesNationwide as boolean) ?? false,
  };
}

export function ProfileSettingsForm({ role }: { role: Role }) {
  const t = useTranslations("dashboardSettings.profile.location");
  const tEditor = useTranslations("dashboardSettings.profile.editor");
  const categoryT = useTranslations("profileCategory");
  const experienceLevelT = useTranslations("experienceLevel");
  const [values, setValues] = useState<ProfileFormValues>(toFormValues(null));
  const [profileId, setProfileId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [extraProvinceIds, setExtraProvinceIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profiles/${role}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          setValues(toFormValues(body.data));
          setProfileId(body.data?.id ?? null);
          setServices(body.data?.services ?? []);
          setExtraProvinceIds(
            ((body.data?.serviceAreas as { provinceId: string }[]) ?? []).map(
              (a) => a.provinceId,
            ),
          );
          setIsPublished(Boolean(body.data?.isPublished));
          setVerificationStatus(body.verificationStatus ?? null);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Real Province/Ward rows (Prompt B4), not a hardcoded list (CLAUDE.md
  // mục 9) — today this is just Thành phố Hồ Chí Minh until more
  // provinces' real data is seeded (see prisma/data/provinces-registry.ts).
  useEffect(() => {
    fetch("/api/geography/provinces")
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])));
  }, []);

  const selectedProvinceCode = provinces.find(
    (p) => p.id === values.provinceId,
  )?.code;

  useEffect(() => {
    if (!selectedProvinceCode) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(
      `/api/geography/wards?provinceCode=${encodeURIComponent(selectedProvinceCode)}`,
    )
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])));
  }, [selectedProvinceCode]);

  const togglePublished = async (next: boolean) => {
    setPublishError(null);
    setIsPublishing(true);
    const res = await fetch(`/api/profiles/${role}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: next }),
    });
    const body = await res.json();
    setIsPublishing(false);
    if (!res.ok) {
      setPublishError(body.message ?? tEditor("publishError"));
      return;
    }
    setIsPublished(next);
  };

  const set = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (category: ProfileCategory) => {
    setValues((prev) => {
      const isSelected = prev.categories.includes(category);
      return {
        ...prev,
        categories: isSelected
          ? prev.categories.filter((c) => c !== category)
          : [...prev.categories, category],
      };
    });
  };

  const toggleAmenity = (amenity: string) => {
    setValues((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const onSave = async () => {
    setIsSaving(true);
    setSaved(false);

    await Promise.all([
      fetch(`/api/profiles/${role}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: values.displayName || undefined,
          description: values.description || undefined,
          website: values.website || undefined,
          instagram: values.instagram || undefined,
          facebook: values.facebook || undefined,
          tiktok: values.tiktok || undefined,
          priceMin: values.priceMin ? Number(values.priceMin) : undefined,
          priceMax: values.priceMax ? Number(values.priceMax) : undefined,
          categories: values.categories,
          address: values.address || undefined,
          area: values.area ? Number(values.area) : undefined,
          amenities: values.amenities,
          shopName: values.shopName || undefined,
          height: values.height ? Number(values.height) : undefined,
          measurements: values.measurements || undefined,
          hairColor: values.hairColor || undefined,
          eyeColor: values.eyeColor || undefined,
          shoeSize: values.shoeSize || undefined,
          experienceLevel: values.experienceLevel || undefined,
          // Booleans are sent as-is (never `|| undefined`) — the profile
          // upsert applies every key it receives, so `undefined` here would
          // mean "leave unchanged" and an unchecked toggle would never be
          // able to turn itself back off.
          travelWilling: values.travelWilling,
          agencyRepresented: values.agencyRepresented,
          agencyName: values.agencyName || undefined,
          hideExactLocation: values.hideExactLocation,
          requireDepositBeforeContact: values.requireDepositBeforeContact,
          // `|| null`, not `|| undefined` — unlike the free-text fields
          // above, clearing the province/ward select must actually clear
          // the stored value (undefined would mean "leave unchanged" and
          // a cleared dropdown could never unset it).
          provinceId: values.provinceId || null,
          wardId: values.wardId || null,
          servesNationwide: values.servesNationwide,
        }),
      }),
      fetch(`/api/profiles/${role}/service-areas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinceIds: extraProvinceIds }),
      }),
    ]);

    setIsSaving(false);
    setSaved(true);
  };

  const toggleExtraProvince = (provinceId: string) => {
    setExtraProvinceIds((prev) =>
      prev.includes(provinceId)
        ? prev.filter((id) => id !== provinceId)
        : [...prev, provinceId],
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPublished ? (
              <ShieldCheck className="size-4 text-success" />
            ) : null}
            <span className="text-body-md font-semibold! text-text-primary">
              {isPublished ? tEditor("liveStatus") : tEditor("draftStatus")}
            </span>
            {verificationStatus === "VERIFIED" ? (
              <Badge variant="success">{tEditor("verifiedBadge")}</Badge>
            ) : null}
          </div>
          <Switch
            checked={isPublished}
            disabled={
              isPublishing ||
              (!isPublished && verificationStatus !== "VERIFIED")
            }
            onChange={togglePublished}
          />
        </div>
        {verificationStatus !== "VERIFIED" ? (
          <p className="text-body-sm text-text-secondary">
            {tEditor("notVerifiedNoteBefore")}{" "}
            <Link
              href={`/onboarding/verification?role=${role}`}
              className="text-text-link hover:underline"
            >
              {tEditor("verifiedLinkText")}
            </Link>
            {tEditor("notVerifiedNoteAfter")}
          </p>
        ) : null}
        {publishError ? (
          <p className="text-body-sm text-danger">{publishError}</p>
        ) : null}
      </div>

      <Input
        label={tEditor("displayNameLabel")}
        value={values.displayName}
        onChange={(e) => set("displayName", e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-body-sm font-semibold! text-text-primary">
            {tEditor("descriptionLabel")}
          </label>
          <span className="text-body-sm text-text-tertiary">
            {values.description.length}/1000
          </span>
        </div>
        <textarea
          maxLength={1000}
          className="min-h-28 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {tEditor("categoriesLabel")}
          </span>
          <span className="text-body-sm text-text-tertiary">
            {tEditor("categoriesCount", { count: values.categories.length })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(CATEGORIES_BY_ROLE[role] ?? []).map((category) => {
            const selected = values.categories.includes(category);
            return (
              <Tag
                key={category}
                selected={selected}
                onClick={() => toggleCategory(category)}
              >
                {categoryT(category)}
              </Tag>
            );
          })}
        </div>
        {values.categories.length === 0 ? (
          <p className="text-body-sm text-warning">
            {tEditor("categoriesRequiredHint")}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label={tEditor("minPriceLabel")}
          value={values.priceMin}
          onChange={(digits) => set("priceMin", digits)}
        />
        <CurrencyInput
          label={tEditor("maxPriceLabel")}
          value={values.priceMax}
          onChange={(digits) => set("priceMax", digits)}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("title")}
        </span>
        {role === "STUDIO" ? (
          <p className="text-body-sm text-text-tertiary">
            {t("studioRequiredNote")}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <NativeSelect
            label={t("provinceLabel")}
            value={values.provinceId}
            onChange={(value) => {
              set("provinceId", value);
              set("wardId", "");
            }}
            options={[
              { value: "", label: t("provinceNotSelected") },
              ...provinces.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <NativeSelect
            label={t("wardLabel")}
            value={values.wardId}
            onChange={(value) => set("wardId", value)}
            disabled={!values.provinceId}
            options={[
              {
                value: "",
                label: values.provinceId
                  ? t("wardNotSelected")
                  : t("wardHelperNoProvince"),
              },
              ...wards.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </div>

        <Switch
          label={t("nationwideLabel")}
          checked={values.servesNationwide}
          onChange={(next) => set("servesNationwide", next)}
        />
        <p className="text-body-sm text-text-tertiary">
          {t("nationwideHelper")}
        </p>

        {provinces.length > 1 ? (
          <div className="flex flex-col gap-2">
            <span className="text-body-sm font-semibold! text-text-primary">
              {t("extraAreasLabel")}
            </span>
            <p className="text-body-sm text-text-tertiary">
              {t("extraAreasHelper")}
            </p>
            <div className="flex flex-wrap gap-2">
              {provinces
                .filter((p) => p.id !== values.provinceId)
                .map((p) => (
                  <Tag
                    key={p.id}
                    selected={extraProvinceIds.includes(p.id)}
                    onClick={() => toggleExtraProvince(p.id)}
                  >
                    {p.name}
                  </Tag>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      {role === "STUDIO" ? (
        <>
          <Input
            label={tEditor("addressLabel")}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
          />
          <Input
            label={tEditor("areaLabel")}
            type="number"
            value={values.area}
            onChange={(e) => set("area", e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {tEditor("amenitiesLabel")}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITY_OPTIONS.map((amenity) => (
                <Checkbox
                  key={amenity}
                  checked={values.amenities.includes(amenity)}
                  onCheckedChange={() => toggleAmenity(amenity)}
                  label={tEditor(`amenities.${amenity}`)}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {role === "MODEL" ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {tEditor("modelDetails.title")}
          </span>
          <p className="text-body-sm text-text-tertiary">
            {tEditor("modelDetails.subtitle")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={tEditor("modelDetails.heightLabel")}
              type="number"
              value={values.height}
              onChange={(e) => set("height", e.target.value)}
            />
            <Input
              label={tEditor("modelDetails.shoeSizeLabel")}
              value={values.shoeSize}
              onChange={(e) => set("shoeSize", e.target.value)}
            />
            <Input
              label={tEditor("modelDetails.measurementsLabel")}
              value={values.measurements}
              onChange={(e) => set("measurements", e.target.value)}
            />
            <NativeSelect
              label={tEditor("modelDetails.experienceLevelLabel")}
              value={values.experienceLevel}
              onChange={(v) =>
                set("experienceLevel", v as ExperienceLevel | "")
              }
              options={[
                {
                  value: "",
                  label: tEditor("modelDetails.experienceLevelNotSpecified"),
                },
                ...EXPERIENCE_LEVELS.map((level) => ({
                  value: level,
                  label: experienceLevelT(level),
                })),
              ]}
            />
            <Input
              label={tEditor("modelDetails.hairColorLabel")}
              value={values.hairColor}
              onChange={(e) => set("hairColor", e.target.value)}
            />
            <Input
              label={tEditor("modelDetails.eyeColorLabel")}
              value={values.eyeColor}
              onChange={(e) => set("eyeColor", e.target.value)}
            />
          </div>
          <Checkbox
            checked={values.travelWilling}
            onCheckedChange={(checked) => set("travelWilling", checked)}
            label={tEditor("modelDetails.travelWillingLabel")}
          />
          <Checkbox
            checked={values.agencyRepresented}
            onCheckedChange={(checked) => set("agencyRepresented", checked)}
            label={tEditor("modelDetails.agencyRepresentedLabel")}
          />
          {values.agencyRepresented ? (
            <Input
              label={tEditor("modelDetails.agencyNameLabel")}
              value={values.agencyName}
              onChange={(e) => set("agencyName", e.target.value)}
            />
          ) : null}

          <div className="h-px bg-border-subtle" />
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {tEditor("modelDetails.privacyTitle")}
          </span>
          <Checkbox
            checked={values.hideExactLocation}
            onCheckedChange={(checked) => set("hideExactLocation", checked)}
            label={tEditor("modelDetails.hideExactLocationLabel")}
          />
          <Checkbox
            checked={values.requireDepositBeforeContact}
            onCheckedChange={(checked) =>
              set("requireDepositBeforeContact", checked)
            }
            label={tEditor("modelDetails.requireDepositLabel")}
          />
        </div>
      ) : null}

      {role === "CAMERA_SHOP" ? (
        <Input
          label={tEditor("shopNameLabel")}
          value={values.shopName}
          onChange={(e) => set("shopName", e.target.value)}
        />
      ) : null}

      {role !== "CAMERA_SHOP" && profileId ? (
        <ServicesManager profileId={profileId} initialServices={services} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={tEditor("websiteLabel")}
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
        />
        <Input
          label={tEditor("instagramLabel")}
          value={values.instagram}
          onChange={(e) => set("instagram", e.target.value)}
        />
        <Input
          label={tEditor("facebookLabel")}
          value={values.facebook}
          onChange={(e) => set("facebook", e.target.value)}
        />
        <Input
          label={tEditor("tiktokLabel")}
          value={values.tiktok}
          onChange={(e) => set("tiktok", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <Button variant="accent" disabled={isSaving} onClick={onSave}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {tEditor("saveChanges")}
        </Button>
        {saved ? (
          <span className="text-body-sm text-success">{tEditor("saved")}</span>
        ) : null}
      </div>
    </div>
  );
}
