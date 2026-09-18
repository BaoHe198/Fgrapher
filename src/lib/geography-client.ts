// Query-versioned URLs bypass geography responses cached before nationwide
// coverage was imported. Bump this whenever the reference dataset changes.
export const GEOGRAPHY_DATA_VERSION = "2026-09-nationwide";

export function provincesApiPath() {
  return `/api/geography/provinces?v=${GEOGRAPHY_DATA_VERSION}`;
}

export function wardsApiPath(provinceCode: string) {
  const params = new URLSearchParams({
    provinceCode,
    v: GEOGRAPHY_DATA_VERSION,
  });
  return `/api/geography/wards?${params.toString()}`;
}
