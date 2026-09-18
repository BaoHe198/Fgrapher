export interface AdministrativeLocation {
  province?: { name: string } | null;
  ward?: {
    name: string;
    province?: { name: string } | null;
  } | null;
}

/**
 * Public location text is intentionally limited to Ward + Province. Detailed
 * addresses stay private even when callers already loaded them for editing.
 */
export function formatAdministrativeLocation(
  primary: AdministrativeLocation,
  fallback?: AdministrativeLocation,
) {
  const ward = primary.ward ?? fallback?.ward ?? null;
  const province =
    primary.province ??
    primary.ward?.province ??
    fallback?.province ??
    fallback?.ward?.province ??
    null;

  return [ward?.name, province?.name].filter(Boolean).join(", ");
}
