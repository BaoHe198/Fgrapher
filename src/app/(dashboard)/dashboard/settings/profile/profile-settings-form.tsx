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
import { startTransition, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AddressAutocomplete,
  type AddressPoint,
} from "@/components/forms/address-autocomplete";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import {
  CATEGORIES_BY_ROLE,
  EXPERIENCE_LEVELS,
  PROVIDER_ROLES,
  SELLER_ROLES,
  SHOP_ROLES,
} from "@/lib/constants";
import { provincesApiPath, wardsApiPath } from "@/lib/geography-client";
import {
  clearSessionDraft,
  draftKey,
  readSessionDraft,
  writeSessionDraft,
} from "@/lib/session-draft";
import { AMENITY_OPTIONS } from "@/lib/validations/profile";

import {
  CostumesManager,
  type CostumeItem,
  type CostumeMedia,
} from "./costumes-manager";
import { ServicesManager } from "./services-manager";

interface ServiceItem {
  id: string;
  kind: string;
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
  zaloUrl: string;
  priceMin: string;
  priceMax: string;
  categories: ProfileCategory[];
  address: string;
  area: string;
  amenities: string[];
  shopName: string;
  deliveryFee: string;
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
  yearsExperience: string;
  depositPercent: string;
  depositPolicy: string;
  cancellationPolicy: string;
  reschedulePolicy: string;
  serviceRadiusKm: string;
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
    zaloUrl: (profile?.zaloUrl as string) ?? "",
    priceMin: profile?.priceMin != null ? String(profile.priceMin) : "",
    priceMax: profile?.priceMax != null ? String(profile.priceMax) : "",
    categories: (profile?.categories as ProfileCategory[]) ?? [],
    address: (profile?.address as string) ?? "",
    area: profile?.area != null ? String(profile.area) : "",
    amenities: (profile?.amenities as string[]) ?? [],
    shopName: (profile?.shopName as string) ?? "",
    deliveryFee:
      profile?.deliveryFee != null ? String(profile.deliveryFee) : "",
    height: profile?.height != null ? String(profile.height) : "",
    measurements: (profile?.measurements as string) ?? "",
    hairColor: (profile?.hairColor as string) ?? "",
    eyeColor: (profile?.eyeColor as string) ?? "",
    shoeSize: (profile?.shoeSize as string) ?? "",
    experienceLevel: (profile?.experienceLevel as ExperienceLevel) ?? "",
    travelWilling: (profile?.travelWilling as boolean) ?? false,
    agencyRepresented: (profile?.agencyRepresented as boolean) ?? false,
    agencyName: (profile?.agencyName as string) ?? "",
    hideExactLocation: (profile?.hideExactLocation as boolean) ?? true,
    requireDepositBeforeContact:
      (profile?.requireDepositBeforeContact as boolean) ?? false,
    provinceId: (profile?.provinceId as string) ?? "",
    wardId: (profile?.wardId as string) ?? "",
    servesNationwide: (profile?.servesNationwide as boolean) ?? false,
    yearsExperience:
      profile?.yearsExperience != null ? String(profile.yearsExperience) : "",
    depositPercent:
      profile?.depositPercent != null ? String(profile.depositPercent) : "",
    depositPolicy: (profile?.depositPolicy as string) ?? "",
    cancellationPolicy: (profile?.cancellationPolicy as string) ?? "",
    reschedulePolicy: (profile?.reschedulePolicy as string) ?? "",
    serviceRadiusKm:
      profile?.serviceRadiusKm != null ? String(profile.serviceRadiusKm) : "",
  };
}

type RequiredField = "provinceId" | "wardId" | "address";

/** What a draft holds: everything this form's own Save button sends. */
interface ProfileDraft {
  values: ProfileFormValues;
  extraProvinceIds: string[];
  addressPoint: AddressPoint | null;
}

export function ProfileSettingsForm({
  role,
  userId,
}: {
  role: Role;
  userId: string;
}) {
  const t = useTranslations("dashboardSettings.profile.location");
  const tEditor = useTranslations("dashboardSettings.profile.editor");
  const tPolicy = useTranslations("dashboardSettings.profile.policy");
  const categoryT = useTranslations("profileCategory");
  const experienceLevelT = useTranslations("experienceLevel");
  const [values, setValues] = useState<ProfileFormValues>(toFormValues(null));
  const [profileId, setProfileId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [costumes, setCostumes] = useState<CostumeItem[]>([]);
  const [profileMedia, setProfileMedia] = useState<CostumeMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus | null>(null);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [extraProvinceIds, setExtraProvinceIds] = useState<string[]>([]);
  // Exact point of an autocomplete suggestion the provider picked this
  // session; null means "geocode the typed text on save".
  const [addressPoint, setAddressPoint] = useState<AddressPoint | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<RequiredField, string>>
  >({});
  const [draftRestored, setDraftRestored] = useState(false);
  // The form as the server last had it, serialized: the draft is whatever
  // differs from this, and the extra-areas request is skipped when its part
  // is unchanged.
  const savedSnapshot = useRef<{ form: string; areas: string } | null>(null);
  const requiredRefs = useRef<Partial<Record<RequiredField, HTMLElement>>>({});
  const storageKey = draftKey("role-profile", userId, role);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profiles/${role}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          const serverValues = toFormValues(body.data);
          // The profile's own province is stored as a service area too
          // (isPrimary); it is not one of the "extra" choices.
          const serverAreas = (
            (body.data?.serviceAreas as { provinceId: string }[]) ?? []
          )
            .map((a) => a.provinceId)
            .filter((id) => id !== serverValues.provinceId);
          savedSnapshot.current = {
            form: JSON.stringify(serverValues),
            areas: JSON.stringify([...serverAreas].sort()),
          };
          // Input left unsaved earlier in this tab (the user moved away, or
          // a save failed) comes back on top of what the server has.
          const draft = readSessionDraft<ProfileDraft>(storageKey);
          setValues(
            draft ? { ...serverValues, ...draft.values } : serverValues,
          );
          setExtraProvinceIds(draft?.extraProvinceIds ?? serverAreas);
          setAddressPoint(draft?.addressPoint ?? null);
          setDraftRestored(Boolean(draft));
          setGeocodingStatus(body.data?.geocodingStatus ?? null);
          setProfileId(body.data?.id ?? null);
          setServices(body.data?.services ?? []);
          setCostumes(body.data?.costumes ?? []);
          setProfileMedia(body.data?.media ?? []);
          setIsPublished(Boolean(body.data?.isPublished));
          setVerificationStatus(body.verificationStatus ?? null);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role, storageKey]);

  // Keep the draft in step with the form. Once the form matches what the
  // server has (nothing typed, or just saved) there is no draft to keep.
  useEffect(() => {
    if (isLoading || !savedSnapshot.current) return;
    const timer = window.setTimeout(() => {
      const unchanged =
        JSON.stringify(values) === savedSnapshot.current?.form &&
        JSON.stringify([...extraProvinceIds].sort()) ===
          savedSnapshot.current?.areas;
      if (unchanged) clearSessionDraft(storageKey);
      else {
        writeSessionDraft(storageKey, {
          values,
          extraProvinceIds,
          addressPoint,
        } satisfies ProfileDraft);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [values, extraProvinceIds, addressPoint, isLoading, storageKey]);

  // Real nationwide Province/Ward rows, never a hardcoded UI list.
  useEffect(() => {
    fetch(provincesApiPath())
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
    fetch(wardsApiPath(selectedProvinceCode))
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])));
  }, [selectedProvinceCode]);

  const set = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "provinceId" || key === "wardId" || key === "address") {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const discardDraft = () => {
    clearSessionDraft(storageKey);
    // Reloading re-reads the saved profile; simpler and more certain than
    // resetting each piece of state by hand.
    window.location.reload();
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
    setSaved(false);
    setSaveError(null);
    // Say which field is missing on the field itself, and bring it into
    // view: the form is several screens long, and one line of text next to
    // the Save button left the provider hunting for what was missing.
    const missing: Partial<Record<RequiredField, string>> = {
      ...(values.provinceId ? {} : { provinceId: t("provinceRequired") }),
      ...(values.wardId ? {} : { wardId: t("wardRequired") }),
      ...(values.address.trim().length >= 5
        ? {}
        : { address: t("addressRequired") }),
    };
    setFieldErrors(missing);
    const firstMissing = (["provinceId", "wardId", "address"] as const).find(
      (field) => missing[field],
    );
    if (firstMissing) {
      setSaveError(t("requiredError"));
      const target = requiredRefs.current[firstMissing];
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target
        ?.querySelector<HTMLElement>("select:not(:disabled), input")
        ?.focus({ preventScroll: true });
      return;
    }
    setIsSaving(true);

    try {
      const profileRes = await fetch(`/api/profiles/${role}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: values.displayName || undefined,
          description: values.description || undefined,
          website: values.website || undefined,
          instagram: values.instagram || undefined,
          facebook: values.facebook || undefined,
          tiktok: values.tiktok || undefined,
          // An explicit null lets the provider remove a previously saved
          // contact link. The API normalizes and allowlists Zalo hosts.
          zaloUrl: values.zaloUrl.trim() || null,
          priceMin: values.priceMin ? Number(values.priceMin) : undefined,
          priceMax: values.priceMax ? Number(values.priceMax) : undefined,
          categories: values.categories,
          address: values.address.trim(),
          addressPoint: addressPoint ?? undefined,
          area: values.area ? Number(values.area) : undefined,
          amenities: values.amenities,
          shopName: values.shopName || undefined,
          // Empty means "this shop does not deliver", which is not the same
          // as a 0 fee — see lib/pricing.ts's resolveDeliveryFee.
          deliveryFee:
            values.deliveryFee === "" ? undefined : Number(values.deliveryFee),
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
          provinceId: values.provinceId,
          wardId: values.wardId,
          servesNationwide: values.servesNationwide,
          // Blank sends null, which clears the value on the public profile.
          ...(PROVIDER_ROLES.includes(role)
            ? {
                yearsExperience: values.yearsExperience
                  ? Number(values.yearsExperience)
                  : null,
                depositPercent: values.depositPercent
                  ? Number(values.depositPercent)
                  : null,
                depositPolicy: values.depositPolicy.trim() || null,
                cancellationPolicy: values.cancellationPolicy.trim() || null,
                reschedulePolicy: values.reschedulePolicy.trim() || null,
                serviceRadiusKm: values.serviceRadiusKm
                  ? Number(values.serviceRadiusKm)
                  : null,
              }
            : {}),
        }),
      });

      // A platform error page (a timeout, a crashed function) is not
      // JSON; reading it must not throw and hide the status behind the
      // generic message.
      const profileBody = await profileRes.json().catch(() => null);
      if (!profileRes.ok) {
        setSaveError(
          profileBody?.message ??
            t("saveFailedStatus", { status: profileRes.status }),
        );
        return;
      }

      // The extra provinces are a second request. Skipping it when they
      // have not changed halves the wait on an ordinary save; the
      // profile's own province is kept in step by the request above.
      const areas = JSON.stringify([...extraProvinceIds].sort());
      if (areas !== savedSnapshot.current?.areas) {
        const areasRes = await fetch(`/api/profiles/${role}/service-areas`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provinceIds: extraProvinceIds }),
        });
        if (!areasRes.ok) {
          const areasBody = await areasRes.json().catch(() => null);
          setSaveError(
            areasBody?.message ??
              t("saveFailedStatus", { status: areasRes.status }),
          );
          return;
        }
      }
      if (profileBody?.data) {
        setIsPublished(Boolean(profileBody.data.isPublished));
        setGeocodingStatus(profileBody.data.geocodingStatus ?? null);
        setProfileId(profileBody.data.id ?? null);
        setAddressPoint(null);
      }
      savedSnapshot.current = { form: JSON.stringify(values), areas };
      clearSessionDraft(storageKey);
      setDraftRestored(false);
      setSaved(true);
    } catch {
      // fetch itself failed: offline, or the connection dropped mid-save.
      setSaveError(t("saveNetworkError"));
    } finally {
      setIsSaving(false);
    }
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
        <div className="flex items-center gap-2">
          {isPublished ? <ShieldCheck className="size-4 text-success" /> : null}
          <span className="text-body-md font-semibold! text-text-primary">
            {isPublished ? tEditor("liveStatus") : tEditor("draftStatus")}
          </span>
          {verificationStatus === "VERIFIED" ? (
            <Badge variant="success">{tEditor("verifiedBadge")}</Badge>
          ) : null}
        </div>
        {!isPublished ? (
          verificationStatus !== "VERIFIED" ? (
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
          ) : (
            <p className="text-body-sm text-text-secondary">
              {tEditor("autoPublishNote")}
            </p>
          )
        ) : null}
      </div>

      {draftRestored ? (
        <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-info-bg px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-text-primary">
            {tEditor("draftRestored")}
          </p>
          <Button variant="ghost" size="sm" onClick={discardDraft}>
            {tEditor("draftDiscard")}
          </Button>
        </div>
      ) : null}

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
          aria-label={tEditor("descriptionLabel")}
          maxLength={1000}
          className="min-h-28 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
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
        <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
          {t("title")}
        </span>
        <p className="text-body-sm text-text-tertiary">{t("requiredNote")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div
            ref={(node) => {
              if (node) requiredRefs.current.provinceId = node;
            }}
          >
            <NativeSelect
              label={t("provinceLabel")}
              requiredMark
              error={fieldErrors.provinceId}
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
          </div>
          <div
            ref={(node) => {
              if (node) requiredRefs.current.wardId = node;
            }}
          >
            <NativeSelect
              label={t("wardLabel")}
              requiredMark
              error={fieldErrors.wardId}
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
        </div>

        <div
          ref={(node) => {
            if (node) requiredRefs.current.address = node;
          }}
        >
          <AddressAutocomplete
            label={tEditor("addressLabel")}
            placeholder={t("addressPlaceholder")}
            value={values.address}
            point={addressPoint}
            provinceId={values.provinceId}
            wardId={values.wardId}
            requiredMark
            error={fieldErrors.address}
            areaNames={[
              provinces.find((p) => p.id === values.provinceId)?.name ?? "",
              wards.find((w) => w.id === values.wardId)?.name ?? "",
            ].filter(Boolean)}
            onChange={(address, point) => {
              set("address", address);
              setAddressPoint(point);
            }}
            onAreaPicked={({ provinceId, wardId }) => {
              setValues((prev) => ({ ...prev, provinceId, wardId }));
              setFieldErrors((prev) => ({
                ...prev,
                provinceId: undefined,
                wardId: undefined,
              }));
            }}
          />
        </div>
        {geocodingStatus && geocodingStatus !== "READY" && !addressPoint ? (
          <p className="rounded-[var(--fg-radius-md)] bg-warning-bg px-3 py-2 text-body-sm text-warning">
            {t("fmapNotVisible")}
          </p>
        ) : null}
        <p className="text-body-sm text-text-tertiary">{t("addressPrivacy")}</p>

        {PROVIDER_ROLES.includes(role) ? (
          <>
            <Switch
              label={t("nationwideLabel")}
              checked={values.servesNationwide}
              onChange={(next) => set("servesNationwide", next)}
            />
            <p className="text-body-sm text-text-tertiary">
              {t("nationwideHelper")}
            </p>
            <Input
              label={tPolicy("radiusLabel")}
              type="number"
              inputMode="numeric"
              min={0}
              max={2000}
              value={values.serviceRadiusKm}
              onChange={(e) => set("serviceRadiusKm", e.target.value)}
            />
            <p className="-mt-2 text-body-sm text-text-tertiary">
              {tPolicy("radiusHelper")}
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
          </>
        ) : null}
      </div>

      {PROVIDER_ROLES.includes(role) ? (
        <section className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle p-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-heading-sm text-text-primary">
              {tPolicy("title")}
            </h3>
            <p className="text-body-sm text-text-tertiary">
              {tPolicy("intro")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={tPolicy("yearsLabel")}
              type="number"
              inputMode="numeric"
              min={0}
              max={70}
              value={values.yearsExperience}
              onChange={(e) => set("yearsExperience", e.target.value)}
            />
            <Input
              label={tPolicy("depositPercentLabel")}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={values.depositPercent}
              onChange={(e) => set("depositPercent", e.target.value)}
            />
          </div>
          <Textarea
            label={tPolicy("depositPolicyLabel")}
            hint={tPolicy("depositPolicyHint")}
            rows={2}
            maxLength={600}
            showCount
            value={values.depositPolicy}
            onChange={(e) => set("depositPolicy", e.target.value)}
          />
          <Textarea
            label={tPolicy("cancellationLabel")}
            hint={tPolicy("cancellationHint")}
            rows={2}
            maxLength={800}
            showCount
            value={values.cancellationPolicy}
            onChange={(e) => set("cancellationPolicy", e.target.value)}
          />
          <Textarea
            label={tPolicy("rescheduleLabel")}
            hint={tPolicy("rescheduleHint")}
            rows={2}
            maxLength={800}
            showCount
            value={values.reschedulePolicy}
            onChange={(e) => set("reschedulePolicy", e.target.value)}
          />
        </section>
      ) : null}

      {role === "STUDIO" ? (
        <>
          <Input
            label={tEditor("areaLabel")}
            type="number"
            value={values.area}
            onChange={(e) => set("area", e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
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
          <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
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
          <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
            {tEditor("modelDetails.privacyTitle")}
          </span>
          <Checkbox
            checked={values.requireDepositBeforeContact}
            onCheckedChange={(checked) =>
              set("requireDepositBeforeContact", checked)
            }
            label={tEditor("modelDetails.requireDepositLabel")}
          />
        </div>
      ) : null}

      {/* Fmap marker privacy — applies to every provider role, not only
          MODEL, since every published provider can appear on the map. */}
      {PROVIDER_ROLES.includes(role) ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <span className="text-caption-upper tracking-[0.12em] text-text-tertiary">
            {tEditor("privacySettings.title")}
          </span>
          <Checkbox
            checked={values.hideExactLocation}
            onCheckedChange={(checked) => set("hideExactLocation", checked)}
            label={tEditor("privacySettings.hideExactLocationLabel")}
          />
          <p className="text-body-sm text-text-tertiary">
            {tEditor("privacySettings.hideExactLocationHelper")}
          </p>
        </div>
      ) : null}

      {/* Product shops trade under a business name and configure pickup or
          delivery details here; their inventory lives under Listings. */}
      {(SHOP_ROLES as readonly string[]).includes(role) ? (
        <Input
          label={tEditor("shopNameLabel")}
          value={values.shopName}
          onChange={(e) => set("shopName", e.target.value)}
        />
      ) : null}

      {(SELLER_ROLES as readonly string[]).includes(role) ? (
        <div className="flex flex-col gap-2">
          <Input
            type="number"
            min={0}
            label={tEditor("deliveryFeeLabel")}
            value={values.deliveryFee}
            onChange={(e) => set("deliveryFee", e.target.value)}
          />
          <p className="text-body-sm text-text-tertiary">
            {tEditor("deliveryFeeHelper")}
          </p>
        </div>
      ) : null}

      {/* Outfits are a costume shop's catalogue, shown on its own profile.
          They are deliberately NOT Chợ F products — see SELLER_ROLES. */}
      {role === "COSTUME_SHOP" && profileId ? (
        <CostumesManager
          profileId={profileId}
          initialCostumes={costumes}
          availableMedia={profileMedia}
        />
      ) : null}

      {PROVIDER_ROLES.includes(role) ? (
        profileId ? (
          <ServicesManager
            profileId={profileId}
            role={role}
            initialServices={services}
          />
        ) : (
          // Profile rows are created lazily on first save — a role that
          // was just activated has none yet, so ServicesManager (which
          // needs a real profileId to attach services to) has nothing to
          // render against. Silently omitting the whole section here
          // read as "packages aren't supported for this role," not "save
          // once first" — say so explicitly instead.
          <p className="text-body-sm text-text-tertiary">
            {tEditor("servicesNeedSaveFirst")}
          </p>
        )
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

      <div className="flex flex-col gap-1.5">
        <Input
          label={tEditor("zaloUrlLabel")}
          type="url"
          value={values.zaloUrl}
          onChange={(e) => set("zaloUrl", e.target.value)}
          placeholder="https://zalo.me/..."
        />
        <p className="text-body-sm text-text-tertiary">
          {tEditor("zaloUrlHelper")}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <Button variant="accent" disabled={isSaving} onClick={onSave}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {tEditor("saveChanges")}
        </Button>
        {saved ? (
          <span className="text-body-sm text-success">{tEditor("saved")}</span>
        ) : null}
        {saveError ? (
          <span className="text-body-sm text-danger">{saveError}</span>
        ) : null}
      </div>
    </div>
  );
}
