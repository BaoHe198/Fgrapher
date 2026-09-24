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

/**
 * A full postal line: street address, then ward and province — each only if
 * the address doesn't already spell it out. People routinely type the ward
 * and city into the address field, and the pickup address on an order read
 * "Phường Tân Bình, TP HCM, Phường Tân Bình, TP HCM" (24/09 audit).
 */
export function formatFullAddress(
  address: string | null | undefined,
  ward: { name: string } | null | undefined,
  province: { name: string } | null | undefined,
) {
  const street = address?.trim() ?? "";
  const lower = street.toLocaleLowerCase("vi");
  const extra = [ward?.name, province?.name].filter(
    (name): name is string =>
      Boolean(name) && !lower.includes(name!.toLocaleLowerCase("vi")),
  );
  return [street, ...extra].filter(Boolean).join(", ");
}
