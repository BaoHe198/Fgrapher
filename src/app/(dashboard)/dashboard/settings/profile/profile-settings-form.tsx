"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
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
}

const CATEGORY_OPTIONS: ProfileCategory[] = [
  "WEDDING",
  "PORTRAIT",
  "FASHION",
  "COMMERCIAL",
  "EVENT",
  "PRODUCT",
  "FOOD",
  "LANDSCAPE",
  "STREET",
  "DOCUMENTARY",
  "MUSIC_VIDEO",
  "CORPORATE",
  "REAL_ESTATE",
  "BRIDAL",
  "EDITORIAL",
  "SFX",
  "NATURAL",
  "GLAM",
  "INDOOR",
  "OUTDOOR",
  "ROOFTOP",
  "CYCLORAMA",
  "GREEN_SCREEN",
];

function toFormValues(profile: Record<string, unknown> | null): ProfileFormValues {
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
  };
}

export function ProfileSettingsForm({ role }: { role: Role }) {
  const [values, setValues] = useState<ProfileFormValues>(toFormValues(null));
  const [profileId, setProfileId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profiles/${role}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          setValues(toFormValues(body.data));
          setProfileId(body.data?.id ?? null);
          setServices(body.data?.services ?? []);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (category: ProfileCategory) => {
    setValues((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
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

    await fetch(`/api/profiles/${role}`, {
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
      }),
    });

    setIsSaving(false);
    setSaved(true);
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
      <Input
        label="Display name"
        value={values.displayName}
        onChange={(e) => set("displayName", e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-body-sm font-semibold text-text-primary">Description</label>
          <span className="text-body-sm text-text-tertiary">{values.description.length}/1000</span>
        </div>
        <textarea
          maxLength={1000}
          className="min-h-28 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3.5 py-2.5 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">Categories</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((category) => (
            <Tag
              key={category}
              selected={values.categories.includes(category)}
              onClick={() => toggleCategory(category)}
            >
              {category.replace(/_/g, " ").toLowerCase()}
            </Tag>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min price"
          type="number"
          value={values.priceMin}
          onChange={(e) => set("priceMin", e.target.value)}
        />
        <Input
          label="Max price"
          type="number"
          value={values.priceMax}
          onChange={(e) => set("priceMax", e.target.value)}
        />
      </div>

      {role === "STUDIO" ? (
        <>
          <Input
            label="Address"
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
          />
          <Input
            label="Area (sqm)"
            type="number"
            value={values.area}
            onChange={(e) => set("area", e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              Amenities
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITY_OPTIONS.map((amenity) => (
                <Checkbox
                  key={amenity}
                  checked={values.amenities.includes(amenity)}
                  onCheckedChange={() => toggleAmenity(amenity)}
                  label={amenity.replace(/_/g, " ")}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {role === "CAMERA_SHOP" ? (
        <Input
          label="Shop name"
          value={values.shopName}
          onChange={(e) => set("shopName", e.target.value)}
        />
      ) : null}

      {role !== "CAMERA_SHOP" && profileId ? (
        <ServicesManager profileId={profileId} initialServices={services} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Website"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
        />
        <Input
          label="Instagram"
          value={values.instagram}
          onChange={(e) => set("instagram", e.target.value)}
        />
        <Input
          label="Facebook"
          value={values.facebook}
          onChange={(e) => set("facebook", e.target.value)}
        />
        <Input
          label="TikTok"
          value={values.tiktok}
          onChange={(e) => set("tiktok", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <Button variant="accent" disabled={isSaving} onClick={onSave}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save changes
        </Button>
        {saved ? <span className="text-body-sm text-success">Saved</span> : null}
      </div>
    </div>
  );
}
