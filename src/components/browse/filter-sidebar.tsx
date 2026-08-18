"use client";

import type { Role } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { PAID_ROLES, ROLE_LABELS } from "@/lib/constants";

const CITIES = [
  "Hồ Chí Minh",
  "Hà Nội",
  "Đà Nẵng",
  "Nha Trang",
  "Hội An",
  "Đà Lạt",
  "Cần Thơ",
  "Hải Phòng",
];

const BUDGET_OPTIONS = [
  { value: "", label: "Any" },
  { value: "0-2000000", label: "Under ₫2M" },
  { value: "2000000-5000000", label: "₫2M – ₫5M" },
  { value: "5000000-15000000", label: "₫5M – ₫15M" },
  { value: "15000000-", label: "Over ₫15M" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "reviews", label: "Most reviewed" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any" },
  { value: "4", label: "4+ stars" },
  { value: "4.5", label: "4.5+ stars" },
];

interface FilterSidebarProps {
  roleCounts: Record<string, number>;
}

export function FilterSidebar({ roleCounts }: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedRoles = (searchParams.get("roles")?.split(",").filter(Boolean) ?? []) as Role[];
  const sort = searchParams.get("sort") ?? "rating";
  const city = searchParams.get("city") ?? "";
  const budget = `${searchParams.get("minPrice") ?? ""}-${searchParams.get("maxPrice") ?? ""}`.replace(
    /^-$/,
    "",
  );
  const minRating = searchParams.get("minRating") ?? "";

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const toggleRole = (role: Role) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    updateParams({ roles: next.length > 0 ? next.join(",") : null });
  };

  const onBudgetChange = (value: string) => {
    if (!value) {
      updateParams({ minPrice: null, maxPrice: null });
      return;
    }
    const [min, max] = value.split("-");
    updateParams({ minPrice: min || null, maxPrice: max || null });
  };

  const resetFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="sticky top-[104px] flex flex-col gap-[22px] rounded-[var(--fg-radius-lg)] bg-surface-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">Role</span>
        <div className="flex flex-col gap-2.5">
          {PAID_ROLES.map((role) => (
            <Checkbox
              key={role}
              checked={selectedRoles.includes(role)}
              onCheckedChange={() => toggleRole(role)}
              label={`${ROLE_LABELS[role]} (${roleCounts[role] ?? 0})`}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">Sort by</span>
        <div className="flex flex-col gap-2.5">
          {SORT_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              name="sort"
              checked={sort === option.value}
              onChange={() => updateParams({ sort: option.value === "rating" ? null : option.value })}
              label={option.label}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-border-subtle" />

      <NativeSelect
        label="City"
        value={city}
        onChange={(value) => updateParams({ city: value || null })}
        options={[{ value: "", label: "All cities" }, ...CITIES.map((c) => ({ value: c, label: c }))]}
      />

      <NativeSelect
        label="Budget"
        value={budget}
        onChange={onBudgetChange}
        options={BUDGET_OPTIONS}
      />

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">Rating</span>
        <div className="flex flex-col gap-2.5">
          {RATING_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              name="rating"
              checked={minRating === option.value}
              onChange={() => updateParams({ minRating: option.value || null })}
              label={option.label}
            />
          ))}
        </div>
      </div>

      <Button variant="secondary" className="w-full" onClick={resetFilters}>
        Reset filters
      </Button>
    </div>
  );
}
