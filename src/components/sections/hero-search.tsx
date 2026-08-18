"use client";

import { MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

const ROLE_KEYS = [
  "Photographer",
  "Videographer",
  "Make-up Artist",
  "Studio",
  "Camera Shop",
] as const;

export function HeroSearch() {
  const t = useTranslations();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex max-w-[560px] items-center gap-2 rounded-[var(--fg-radius-lg)] bg-bg-surface p-2.5 shadow-[var(--shadow-lg)]">
        <Search className="size-[18px] shrink-0 text-text-tertiary" />
        <input
          type="text"
          placeholder={t("hero.searchPh")}
          className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <div className="h-[26px] w-px shrink-0 bg-border-subtle" />
        <MapPin className="size-[18px] shrink-0 text-text-tertiary" />
        <input
          type="text"
          defaultValue={t("hero.city")}
          className="w-20 shrink-0 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <Button
          variant="accent"
          nativeButton={false}
          render={<Link href="/browse" />}
        >
          {t("hero.cta")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLE_KEYS.map((roleKey) => (
          <Tag
            key={roleKey}
            selected={selectedRole === roleKey}
            onClick={() =>
              setSelectedRole((prev) => (prev === roleKey ? null : roleKey))
            }
          >
            {t(`role.${roleKey}`)}
          </Tag>
        ))}
      </div>
    </div>
  );
}
