"use client";

import type { Role } from "@prisma/client";
import { MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

const HERO_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
  "MODEL",
];

export function HeroSearch({
  marketplaceEnabled,
}: {
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const roleOptions = HERO_ROLES.filter(
    (role) => marketplaceEnabled || role !== "CAMERA_SHOP",
  );

  const onSearch = () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (city) params.set("city", city);
    if (selectedRole) params.set("roles", selectedRole);
    router.push(`/browse?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex max-w-[560px] items-center gap-2 rounded-[var(--fg-radius-lg)] bg-bg-surface p-2.5 shadow-[var(--shadow-lg)]">
        <Search className="size-[18px] shrink-0 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder={t("hero.searchPh")}
          className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <div className="h-[26px] w-px shrink-0 bg-border-subtle" />
        <MapPin className="size-[18px] shrink-0 text-text-tertiary" />
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder={t("hero.city")}
          className="w-20 shrink-0 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <Button variant="accent" onClick={onSearch}>
          {t("hero.cta")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {roleOptions.map((role) => (
          <Tag
            key={role}
            selected={selectedRole === role}
            onClick={() =>
              setSelectedRole((prev) => (prev === role ? null : role))
            }
          >
            {t(`role.${role}`)}
          </Tag>
        ))}
      </div>
    </div>
  );
}
