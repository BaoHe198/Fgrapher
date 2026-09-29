import { useTranslations } from "next-intl";

// "Khu vực phục vụ" (redesign 09/2026): where the provider is based, how
// far they travel without a travel fee, and whether they take work
// nationwide. The drawing is a sketch, not a map - the exact address is
// private (Profile.hideExactLocation), so nothing here is drawn to scale
// or placed on real coordinates.
export function ServiceArea({
  location,
  radiusKm,
  nationwide,
}: {
  location: string | null;
  radiusKm: number | null;
  nationwide: boolean;
}) {
  const t = useTranslations("publicPages.profile.area");
  const summary = [location, radiusKm ? t("radius", { km: radiusKm }) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/7] overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-sunken max-sm:aspect-[4/3]">
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] bg-[size:32px_32px]"
        />
        <span
          aria-hidden
          className="absolute top-[62%] -left-[10%] h-6 w-[130%] -rotate-[8deg] bg-green-100 dark:bg-green-900/60"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 aspect-square h-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-gold-400 bg-gold-400/15"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-green-900 ring-4 ring-bg-surface"
        />
        {summary ? (
          <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-[var(--fg-radius-sm)] bg-bg-surface px-3 py-1.5 text-meta text-text-primary shadow-[var(--shadow-sm)]">
            {summary}
          </span>
        ) : null}
      </div>
      <p className="text-body-sm text-text-secondary">
        {nationwide
          ? radiusKm
            ? t("nationwideWithRadius", { km: radiusKm })
            : t("nationwide")
          : radiusKm
            ? t("localWithRadius", { km: radiusKm })
            : t("local")}
      </p>
    </div>
  );
}
