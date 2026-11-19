import { foldVietnamese } from "@/lib/vietnam/fold";

/**
 * Matches the ward and province a geocoder names ("Phường Vũng Tàu",
 * "Thành phố Hồ Chí Minh") to our own Province/Ward rows, so picking an
 * address suggestion can fill the form's two area selects.
 *
 * Geocoders are not consistent about the administrative prefix — MapTiler
 * says "Khánh Hòa" where our row is "Tỉnh Khánh Hòa", and "Nha Trang" for
 * "Phường Nha Trang" — so names are compared with the prefix removed. A
 * match that is not unique is no match: a wrong ward is worse than an empty
 * select the provider fills themselves.
 */

const PREFIX =
  /^(?:thanh pho|tp\.?|tinh|phuong|xa|thi tran|thi xa|quan|huyen|dac khu)\s+/;

function fold(name: string) {
  return foldVietnamese(name).replace(/\s+/g, " ").trim();
}

function core(name: string) {
  return fold(name).replace(PREFIX, "");
}

interface NamedArea {
  id: string;
  name: string;
}

function matchOne<T extends NamedArea>(name: string, rows: T[]): T | null {
  const wanted = core(name);
  if (!wanted) return null;
  const candidates = rows.filter((row) => core(row.name) === wanted);
  if (candidates.length === 1) return candidates[0];
  // "Phường An Phú" and "Xã An Phú" in one province: only the exact name,
  // prefix included, tells them apart.
  const exact = candidates.filter((row) => fold(row.name) === fold(name));
  return exact.length === 1 ? exact[0] : null;
}

export function matchProvince<T extends NamedArea>(
  name: string | undefined,
  provinces: T[],
): T | null {
  return name ? matchOne(name, provinces) : null;
}

/** `wards` must already be limited to one province. */
export function matchWard<T extends NamedArea>(
  name: string | undefined,
  wards: T[],
): T | null {
  return name ? matchOne(name, wards) : null;
}
