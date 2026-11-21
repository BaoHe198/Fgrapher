"use client";

import type { PlaceKind, ProfileCategory } from "@prisma/client";
import { LocateFixed, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  type ExistingPlacePhoto,
  type NewPlacePhoto,
  PlacePhotoField,
} from "@/components/places/place-photo-field";
import type { PinPoint } from "@/components/places/place-pin-map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MAX_PLACE_PHOTOS, PLACE_CATEGORIES, PLACE_KINDS } from "@/lib/places";

const PlacePinMap = dynamic(
  () =>
    import("@/components/places/place-pin-map").then(
      (module) => module.PlacePinMap,
    ),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-bg-sunken" />,
  },
);

export interface PlaceFormValues {
  name: string;
  description: string;
  kind: PlaceKind | "";
  categories: ProfileCategory[];
  provinceId: string;
  wardId: string;
  address: string;
  pin: PinPoint | null;
  bestTimeNote: string;
  bestMonths: number[];
  fee: "free" | "paid" | "unknown";
  entryFeeVnd: string;
  feeNote: string;
  permit: "yes" | "no" | "unknown";
  rulesNote: string;
  crowdNote: string;
  parkingNote: string;
}

export const EMPTY_PLACE_FORM: PlaceFormValues = {
  name: "",
  description: "",
  kind: "",
  categories: [],
  provinceId: "",
  wardId: "",
  address: "",
  pin: null,
  bestTimeNote: "",
  bestMonths: [],
  fee: "unknown",
  entryFeeVnd: "",
  feeNote: "",
  permit: "unknown",
  rulesNote: "",
  crowdNote: "",
  parkingNote: "",
};

type Mode = "propose" | "edit" | "adminCreate" | "adminEdit";

interface Nearby {
  id: string;
  name: string;
  reviewStatus: string;
  distanceM: number;
  href: string | null;
}

interface PlaceFormProps {
  mode: Mode;
  placeId?: string;
  initial: PlaceFormValues;
  existingPhotos?: ExistingPlacePhoto[];
  provinces: { id: string; code: string; name: string }[];
  /** Where to go once saved. */
  doneHref: string;
}

type Errors = Partial<
  Record<keyof PlaceFormValues | "photos" | "rights", string>
>;

/**
 * The one form for a photo spot: a provider proposing or re-sending one,
 * and an admin adding or editing one. The facts are the same; only where
 * it sends them differs (and an admin edits photos on the review page).
 */
export function PlaceForm({
  mode,
  placeId,
  initial,
  existingPhotos = [],
  provinces,
  doneHref,
}: PlaceFormProps) {
  const t = useTranslations("places.form");
  const kindT = useTranslations("places.kinds");
  const categoryT = useTranslations("profileCategory");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  // Wards of the province they were loaded for: changing province shows
  // none until the new list arrives, rather than the old province's.
  const [wardList, setWardList] = useState<{
    provinceCode: string;
    wards: { id: string; name: string }[];
  } | null>(null);
  const [existing, setExisting] = useState(existingPhotos);
  const [photos, setPhotos] = useState<NewPlacePhoto[]>([]);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby[] | null>(null);
  const [notDuplicate, setNotDuplicate] = useState(false);
  const [centre, setCentre] = useState<(PinPoint & { nonce: number }) | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  // The province/ward the pin lies in, from /api/places/area: fills empty
  // selects and warns when the chosen province is elsewhere.
  const [pinArea, setPinArea] = useState<{
    provinceId: string | null;
    wardId: string | null;
  } | null>(null);
  const [areaFilled, setAreaFilled] = useState(false);
  const areaTimer = useRef<number | null>(null);
  const nearbyRef = useRef<HTMLDivElement>(null);
  const withPhotos = mode !== "adminEdit";
  const photosRequired = mode === "propose" || mode === "edit";

  const set = <K extends keyof PlaceFormValues>(
    key: K,
    value: PlaceFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const provinceCode = provinces.find((p) => p.id === values.provinceId)?.code;
  const wards =
    provinceCode && wardList?.provinceCode === provinceCode
      ? wardList.wards
      : [];
  useEffect(() => {
    if (!provinceCode) return;
    const controller = new AbortController();
    fetch(`/api/geography/wards?provinceCode=${provinceCode}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((body) => setWardList({ provinceCode, wards: body.data ?? [] }))
      .catch(() => {});
    return () => controller.abort();
  }, [provinceCode]);

  const lookUpArea = (point: PinPoint) => {
    if (areaTimer.current) window.clearTimeout(areaTimer.current);
    areaTimer.current = window.setTimeout(async () => {
      const res = await fetch(
        `/api/places/area?lat=${point.latitude}&lng=${point.longitude}`,
      ).catch(() => null);
      const body = await res?.json().catch(() => null);
      const area = body?.data as
        { provinceId: string | null; wardId: string | null } | undefined;
      if (!area?.provinceId) {
        setPinArea(null);
        return;
      }
      setPinArea(area);
      setValues((prev) => {
        if (!prev.provinceId) {
          setAreaFilled(true);
          return {
            ...prev,
            provinceId: area.provinceId!,
            wardId: area.wardId ?? "",
          };
        }
        if (
          prev.provinceId === area.provinceId &&
          !prev.wardId &&
          area.wardId
        ) {
          setAreaFilled(true);
          return { ...prev, wardId: area.wardId };
        }
        return prev;
      });
    }, 400);
  };
  const pinProvince =
    pinArea?.provinceId &&
    values.provinceId &&
    pinArea.provinceId !== values.provinceId
      ? (provinces.find((p) => p.id === pinArea.provinceId) ?? null)
      : null;

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const validate = (): Errors => {
    const next: Errors = {};
    if (values.name.trim().length < 3) next.name = t("nameTooShort");
    if (values.description.trim().length < 30) {
      next.description = t("descriptionTooShort");
    }
    if (!values.kind) next.kind = t("kindRequired");
    if (!values.provinceId) next.provinceId = t("provinceRequired");
    if (!values.pin) next.pin = t("pinMissing");
    if (values.fee === "paid" && !values.entryFeeVnd.replace(/\D/g, "")) {
      next.entryFeeVnd = t("feeRequired");
    }
    if (withPhotos && photosRequired && existing.length + photos.length === 0) {
      next.photos = t("photosRequired");
    }
    // New photos need the rights confirmation; photos already sent were
    // confirmed when they were.
    if (withPhotos && photos.length > 0 && !rights) {
      next.rights = t("rightsRequired");
    }
    return next;
  };

  const payload = () => {
    const facts = {
      name: values.name.trim(),
      description: values.description.trim(),
      kind: values.kind,
      categories: values.categories,
      provinceId: values.provinceId,
      wardId: values.wardId || null,
      address: values.address,
      latitude: values.pin?.latitude,
      longitude: values.pin?.longitude,
      bestTimeNote: values.bestTimeNote,
      bestMonths: values.bestMonths,
      entryFeeVnd:
        values.fee === "free"
          ? 0
          : values.fee === "paid"
            ? Number(values.entryFeeVnd.replace(/\D/g, ""))
            : null,
      feeNote: values.feeNote,
      permitRequired:
        values.permit === "unknown" ? null : values.permit === "yes",
      rulesNote: values.rulesNote,
      crowdNote: values.crowdNote,
      parkingNote: values.parkingNote,
    };
    if (mode === "adminEdit") return facts;
    if (mode === "adminCreate") {
      return { ...facts, photos, rightsConfirmed: true };
    }
    return {
      ...facts,
      photos,
      keepPhotoIds: existing.map((photo) => photo.id),
      rightsConfirmed: true,
      notDuplicate,
    };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFormError(t("fixErrors"));
      return;
    }
    setSubmitting(true);
    const target =
      mode === "propose"
        ? { url: "/api/places", method: "POST" }
        : mode === "edit"
          ? { url: `/api/places/${placeId}`, method: "PUT" }
          : mode === "adminCreate"
            ? { url: "/api/admin/places", method: "POST" }
            : { url: `/api/admin/places/${placeId}`, method: "PATCH" };
    const res = await fetch(target.url, {
      method: target.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSubmitting(false);

    if (res?.ok) {
      toast.add({
        title:
          mode === "propose" || mode === "edit" ? t("submitted") : t("saved"),
        type: "success",
      });
      const id = body?.data?.id;
      router.push(
        mode === "adminCreate" && id ? `/admin/places/${id}` : doneHref,
      );
      router.refresh();
      return;
    }
    if (res?.status === 409 && body?.error === "duplicate") {
      setNearby(body.data?.nearby ?? []);
      setNotDuplicate(false);
      requestAnimationFrame(() =>
        nearbyRef.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        }),
      );
      return;
    }
    setFormError(body?.message ?? t("fixErrors"));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setErrors((prev) => ({ ...prev, pin: t("locationFailed") }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        set("pin", point);
        setCentre({ ...point, nonce: Date.now() });
        lookUpArea(point);
      },
      () => {
        setLocating(false);
        setErrors((prev) => ({ ...prev, pin: t("locationFailed") }));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const sectionClass = "flex flex-col gap-4 border-t border-border-subtle pt-6";
  const groupLabel = "text-body-sm font-semibold text-text-primary";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <p className="text-body-md text-text-secondary">{t("intro")}</p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-heading-md text-text-primary">
          {t("sectionPlace")}
        </legend>
        <Input
          label={t("name")}
          requiredMark
          placeholder={t("namePlaceholder")}
          value={values.name}
          maxLength={120}
          onChange={(e) => set("name", e.target.value)}
          error={errors.name}
        />
        <NativeSelect
          label={t("kind")}
          requiredMark
          value={values.kind}
          onChange={(value) => set("kind", value as PlaceKind | "")}
          error={errors.kind}
          options={[
            { value: "", label: t("kindPlaceholder") },
            ...PLACE_KINDS.map((kind) => ({ value: kind, label: kindT(kind) })),
          ]}
        />
        <div
          role="group"
          aria-labelledby="place-categories"
          className="flex flex-col gap-2"
        >
          <span id="place-categories" className={groupLabel}>
            {t("categories")}
          </span>
          <span className="text-body-sm text-text-secondary">
            {t("categoriesHint")}
          </span>
          <div className="flex flex-wrap gap-2">
            {PLACE_CATEGORIES.map((category) => (
              <Tag
                key={category}
                selected={values.categories.includes(category)}
                onClick={() =>
                  set("categories", toggle(values.categories, category))
                }
              >
                {categoryT(category)}
              </Tag>
            ))}
          </div>
        </div>
        <Textarea
          label={`${t("description")} *`}
          hint={t("descriptionHint")}
          value={values.description}
          maxLength={3000}
          showCount
          rows={5}
          onChange={(e) => set("description", e.target.value)}
          error={errors.description}
        />
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="mb-2 text-heading-md text-text-primary">
          {t("sectionLocation")}
        </legend>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-body-sm text-text-secondary">
              {t("mapHint")}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LocateFixed />
              )}
              {t("useMyLocation")}
            </Button>
          </div>
          <div
            className={
              "relative h-72 overflow-hidden rounded-[var(--fg-radius-md)] border sm:h-96 " +
              (errors.pin ? "border-danger" : "border-border-default")
            }
          >
            <PlacePinMap
              value={values.pin}
              onChange={(point) => {
                set("pin", point);
                setErrors((prev) => ({ ...prev, pin: undefined }));
                setNearby(null);
                lookUpArea(point);
              }}
              centreRequest={centre}
              label={t("mapHint")}
              gestureHelp={{
                mobile: t("mapTwoFingers"),
                windows: t("mapCtrlScroll"),
                mac: t("mapCmdScroll"),
              }}
            />
          </div>
          {values.pin ? (
            <span className="font-mono text-meta text-text-tertiary tabular-nums">
              {values.pin.latitude.toFixed(5)},{" "}
              {values.pin.longitude.toFixed(5)}
            </span>
          ) : null}
          {errors.pin ? (
            <p className="text-body-sm text-danger" role="alert">
              {errors.pin}
            </p>
          ) : null}
          {pinProvince ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-[var(--fg-radius-md)] bg-warning-bg p-3 text-body-sm text-warning"
            >
              <span>
                {t("pinProvinceMismatch", { province: pinProvince.name })}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    provinceId: pinProvince.id,
                    wardId: pinArea?.wardId ?? "",
                  }))
                }
              >
                {t("useProvince", { province: pinProvince.name })}
              </Button>
            </div>
          ) : areaFilled && values.provinceId ? (
            <p role="status" className="text-body-sm text-text-secondary">
              {t("areaFilled")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NativeSelect
            label={t("province")}
            requiredMark
            value={values.provinceId}
            onChange={(value) =>
              setValues((prev) => ({ ...prev, provinceId: value, wardId: "" }))
            }
            error={errors.provinceId}
            options={[
              { value: "", label: t("provincePlaceholder") },
              ...provinces.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <NativeSelect
            label={t("ward")}
            value={values.wardId}
            onChange={(value) => set("wardId", value)}
            disabled={wards.length === 0}
            options={[
              { value: "", label: t("wardPlaceholder") },
              ...wards.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </div>
        <Input
          label={t("address")}
          placeholder={t("addressPlaceholder")}
          value={values.address}
          maxLength={300}
          onChange={(e) => set("address", e.target.value)}
        />
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className="mb-2 text-heading-md text-text-primary">
          {t("sectionFacts")}
        </legend>
        <p className="-mt-2 text-body-sm text-text-secondary">
          {t("factsHint")}
        </p>
        <Input
          label={t("bestTime")}
          placeholder={t("bestTimePlaceholder")}
          value={values.bestTimeNote}
          maxLength={300}
          onChange={(e) => set("bestTimeNote", e.target.value)}
        />
        <div
          role="group"
          aria-labelledby="place-months"
          className="flex flex-col gap-2"
        >
          <span id="place-months" className={groupLabel}>
            {t("bestMonths")}
          </span>
          <span className="text-body-sm text-text-secondary">
            {t("bestMonthsHint")}
          </span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <Tag
                key={month}
                className="px-2"
                selected={values.bestMonths.includes(month)}
                onClick={() =>
                  set("bestMonths", toggle(values.bestMonths, month))
                }
              >
                {`T${month}`}
                <span className="sr-only">{` (${month})`}</span>
              </Tag>
            ))}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="place-fee"
          className="flex flex-col gap-2"
        >
          <span id="place-fee" className={groupLabel}>
            {t("entryFee")}
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(["free", "paid", "unknown"] as const).map((option) => (
              <Radio
                key={option}
                name="place-fee"
                checked={values.fee === option}
                onChange={() => set("fee", option)}
                label={t(
                  option === "free"
                    ? "feeFree"
                    : option === "paid"
                      ? "feePaid"
                      : "feeUnknown",
                )}
              />
            ))}
          </div>
          {values.fee === "paid" ? (
            <Input
              label={t("feeAmount")}
              inputMode="numeric"
              value={values.entryFeeVnd}
              onChange={(e) =>
                set(
                  "entryFeeVnd",
                  e.target.value.replace(/\D/g, "")
                    ? new Intl.NumberFormat("vi-VN").format(
                        Number(e.target.value.replace(/\D/g, "")),
                      )
                    : "",
                )
              }
              error={errors.entryFeeVnd}
            />
          ) : null}
        </div>
        <Input
          label={t("feeNote")}
          placeholder={t("feeNotePlaceholder")}
          value={values.feeNote}
          maxLength={500}
          onChange={(e) => set("feeNote", e.target.value)}
        />
        <div
          role="radiogroup"
          aria-labelledby="place-permit"
          className="flex flex-col gap-2"
        >
          <span id="place-permit" className={groupLabel}>
            {t("permit")}
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(["yes", "no", "unknown"] as const).map((option) => (
              <Radio
                key={option}
                name="place-permit"
                checked={values.permit === option}
                onChange={() => set("permit", option)}
                label={t(
                  option === "yes"
                    ? "permitYes"
                    : option === "no"
                      ? "permitNo"
                      : "permitUnknown",
                )}
              />
            ))}
          </div>
        </div>
        <Input
          label={t("rules")}
          placeholder={t("rulesPlaceholder")}
          value={values.rulesNote}
          maxLength={500}
          onChange={(e) => set("rulesNote", e.target.value)}
        />
        <Input
          label={t("crowd")}
          placeholder={t("crowdPlaceholder")}
          value={values.crowdNote}
          maxLength={300}
          onChange={(e) => set("crowdNote", e.target.value)}
        />
        <Input
          label={t("parking")}
          placeholder={t("parkingPlaceholder")}
          value={values.parkingNote}
          maxLength={300}
          onChange={(e) => set("parkingNote", e.target.value)}
        />
      </fieldset>

      {withPhotos ? (
        <fieldset className={sectionClass}>
          <legend className="mb-2 text-heading-md text-text-primary">
            {t("sectionPhotos")}
            {photosRequired ? " *" : ""}
          </legend>
          <PlacePhotoField
            existing={existing}
            onExistingChange={setExisting}
            value={photos}
            onChange={(next) => {
              setPhotos(next);
              setErrors((prev) => ({ ...prev, photos: undefined }));
            }}
            max={mode === "adminCreate" ? 30 : MAX_PLACE_PHOTOS}
            error={errors.photos}
          />
          <Checkbox
            checked={rights}
            onCheckedChange={(checked) => {
              setRights(checked === true);
              setErrors((prev) => ({ ...prev, rights: undefined }));
            }}
            aria-invalid={errors.rights ? true : undefined}
            label={t("rights")}
          />
          {errors.rights ? (
            <p className="text-body-sm text-danger" role="alert">
              {errors.rights}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {nearby && nearby.length > 0 ? (
        <div
          ref={nearbyRef}
          role="alert"
          className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-warning/40 bg-warning-bg p-4"
        >
          <p className="font-semibold text-warning">{t("duplicateTitle")}</p>
          <p className="text-body-sm text-text-primary">
            {t("duplicateBody", { meters: 200 })}
          </p>
          <ul className="flex flex-col gap-1">
            {nearby.map((place) => (
              <li key={place.id} className="text-body-sm text-text-primary">
                {place.href ? (
                  <Link
                    href={place.href}
                    target="_blank"
                    className="font-semibold text-text-link hover:underline"
                  >
                    {place.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{place.name}</span>
                )}{" "}
                <span className="text-text-secondary">
                  ({t("duplicateDistance", { meters: place.distanceM })}
                  {place.reviewStatus === "PENDING"
                    ? `, ${t("duplicatePending")}`
                    : ""}
                  )
                </span>
              </li>
            ))}
          </ul>
          <Checkbox
            checked={notDuplicate}
            onCheckedChange={(checked) => setNotDuplicate(checked === true)}
            label={t("notDuplicate")}
          />
        </div>
      ) : null}

      {formError ? (
        <p className="text-body-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={
            submitting ||
            (nearby !== null && nearby.length > 0 && !notDuplicate)
          }
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {submitting
            ? t("submitting")
            : mode === "propose"
              ? t("submit")
              : mode === "edit"
                ? t("resubmit")
                : mode === "adminCreate"
                  ? t("adminSubmit")
                  : t("adminSave")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          nativeButton={false}
          render={<Link href={doneHref} />}
        >
          {t("back")}
        </Button>
      </div>
    </form>
  );
}
