"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Select } from "@base-ui/react/select";
import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  Check,
  LayoutGrid,
  MapPin,
  Navigation,
  Palette,
  Shirt,
  UserRound,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

import { cn } from "@/lib/utils";
import { foldVietnamese } from "@/lib/vietnam/fold";

export const ROLE_ICONS: Partial<Record<Role, LucideIcon>> = {
  PHOTOGRAPHER: Camera,
  VIDEOGRAPHER: Video,
  MAKEUP_ARTIST: Palette,
  MODEL: UserRound,
  STUDIO: Building2,
  COSTUME_SHOP: Shirt,
};

export interface ProvinceOption {
  code: string;
  name: string;
}

// The search pill's two pickers, drawn like Airbnb's (owner, 17/11/2026):
// a floating rounded panel under the field with an icon tile per row,
// instead of the browser's own grey <select> list.
const FIELD =
  "relative flex min-w-0 flex-1 flex-col gap-0.5 rounded-full px-6 py-3 text-left transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-sunken focus-within:bg-bg-sunken data-[popup-open]:bg-bg-sunken max-md:rounded-[var(--fg-radius-lg)] max-md:px-4";
const LABEL = "text-meta font-semibold! text-text-primary";
const POPUP =
  "w-[min(380px,var(--available-width))] origin-[var(--transform-origin)] overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-2 text-text-primary shadow-[0_12px_40px_-12px_hsl(264_40%_14%/0.35)] outline-none transition-[scale,opacity] duration-[var(--fg-dur-150)] ease-fg-out data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0";
const ROW =
  "flex cursor-pointer items-center gap-3 rounded-[var(--fg-radius-md)] px-2.5 py-2 outline-none select-none data-highlighted:bg-bg-sunken";
const TILE =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--fg-radius-md)] bg-bg-sunken text-text-primary";
const TILE_ACTIVE =
  "bg-gold-50 text-gold-600 dark:bg-gold-900/40 dark:text-gold-300";

// "Thành phố Cần Thơ" reads as "Cần Thơ" with its kind underneath, the way
// a destination list does. Only the administrative prefix is split off; the
// names themselves come from the registry.
function splitProvinceName(name: string) {
  const match = /^(Thành phố|Tỉnh)\s+(.+)$/.exec(name);
  return match
    ? { kind: match[1], place: match[2] }
    : { kind: null, place: name };
}

const ANYWHERE: ProvinceOption = { code: "", name: "" };

export function ProvincePicker({
  provinces,
  value,
  onChange,
}: {
  provinces: ProvinceOption[];
  value: string;
  onChange: (code: string) => void;
}) {
  const t = useTranslations("home.search");
  const id = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const items = [ANYWHERE, ...provinces];
  const selected = provinces.find((p) => p.code === value) ?? null;

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(next: ProvinceOption | null) =>
        onChange(next?.code ?? "")
      }
      itemToStringLabel={(item: ProvinceOption) => item.name}
      isItemEqualToValue={(a: ProvinceOption, b: ProvinceOption) =>
        a.code === b.code
      }
      // Accent-insensitive: "can tho" finds Cần Thơ. "Mọi tỉnh/thành" only
      // shows while nothing is typed.
      filter={(item: ProvinceOption, query: string) => {
        const q = foldVietnamese(query.trim());
        if (!item.code) return q === "";
        return foldVietnamese(item.name).includes(q);
      }}
      autoHighlight
    >
      <Combobox.InputGroup ref={fieldRef} className={FIELD}>
        <label htmlFor={id} className={LABEL}>
          {t("where")}
        </label>
        <Combobox.Input
          id={id}
          placeholder={t("anywhere")}
          className="w-full min-w-0 bg-transparent pr-6 text-body-sm text-text-primary outline-none placeholder:text-text-secondary"
        />
        {selected ? (
          <Combobox.Clear
            aria-label={t("clearWhere")}
            className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-bg-surface text-text-secondary shadow-[var(--shadow-sm)] hover:text-text-primary"
          >
            <X aria-hidden className="size-3.5" />
          </Combobox.Clear>
        ) : null}
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner
          anchor={fieldRef}
          align="start"
          sideOffset={12}
          className="z-50 outline-none"
        >
          <Combobox.Popup className={POPUP}>
            <p className="px-2.5 pt-1.5 pb-2 text-meta font-semibold! text-text-secondary">
              {t("pickProvince")}
            </p>
            <Combobox.Empty>
              <p className="px-2.5 py-6 text-center text-body-sm text-text-secondary">
                {t("noProvince")}
              </p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,calc(var(--available-height)-3rem))] scroll-py-2 overflow-y-auto overscroll-contain data-empty:hidden">
              {(item: ProvinceOption) => {
                const anywhere = !item.code;
                const { kind, place } = splitProvinceName(item.name);
                const active = anywhere ? !selected : item.code === value;
                return (
                  <Combobox.Item
                    key={item.code || "all"}
                    value={item}
                    className={ROW}
                  >
                    <span className={cn(TILE, active && TILE_ACTIVE)}>
                      {anywhere ? (
                        <Navigation aria-hidden className="size-5" />
                      ) : (
                        <MapPin aria-hidden className="size-5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-sm font-semibold! text-text-primary">
                        {anywhere ? t("anywhere") : place}
                      </span>
                      <span className="truncate text-meta text-text-secondary">
                        {anywhere ? t("anywhereHint") : kind}
                      </span>
                    </span>
                    {active ? (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-gold-500"
                      />
                    ) : null}
                  </Combobox.Item>
                );
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export function ServicePicker({
  roles,
  value,
  onChange,
}: {
  roles: Role[];
  value: string;
  onChange: (role: string) => void;
}) {
  const t = useTranslations("home.search");
  const roleT = useTranslations("role");
  const items: { value: Role | null; label: string }[] = [
    { value: null, label: t("anyService") },
    ...roles.map((r) => ({ value: r, label: roleT(r) })),
  ];

  return (
    <Select.Root
      items={items}
      value={(value || null) as Role | null}
      onValueChange={(next: Role | null) => onChange(next ?? "")}
    >
      <Select.Trigger
        aria-label={t("what")}
        data-slot="service-trigger"
        className={cn(FIELD, "cursor-pointer outline-none")}
      >
        <span className={LABEL}>{t("what")}</span>
        <Select.Value className="truncate text-body-sm text-text-secondary data-[placeholder]:text-text-secondary" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          alignItemWithTrigger={false}
          align="end"
          sideOffset={12}
          className="z-50 outline-none"
        >
          <Select.Popup
            className={cn(POPUP, "w-[min(320px,var(--available-width))]")}
          >
            <Select.List className="max-h-[min(24rem,var(--available-height))] overflow-y-auto overscroll-contain">
              {items.map((item) => {
                const Icon = item.value
                  ? (ROLE_ICONS[item.value] ?? Camera)
                  : LayoutGrid;
                const active = (item.value ?? "") === value;
                return (
                  <Select.Item
                    key={item.value ?? "all"}
                    value={item.value}
                    className={ROW}
                  >
                    <span className={cn(TILE, active && TILE_ACTIVE)}>
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <Select.ItemText className="flex-1 truncate text-body-sm font-semibold! text-text-primary">
                      {item.label}
                    </Select.ItemText>
                    <Select.ItemIndicator>
                      <Check aria-hidden className="size-4 text-gold-500" />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
