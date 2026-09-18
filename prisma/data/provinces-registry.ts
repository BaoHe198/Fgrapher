// Registry for all 34 post-merger provinces/cities and 3,321 wards supplied
// by the project owner. nationwide-wards.ts is generated from the source
// workbook; Hồ Chí Minh keeps its earlier numeric ward codes so existing
// User/Profile foreign keys continue pointing at the same places.

import { HCMC_PROVINCE, HCMC_WARDS } from "./hcmc-wards";
import { NATIONWIDE_PROVINCES } from "./nationwide-wards";

export interface WardSeedEntry {
  code: string;
  name: string;
}

export interface ProvinceSeedEntry {
  province: { code: string; name: string };
  wards: WardSeedEntry[];
}

export const PROVINCE_REGISTRY: ProvinceSeedEntry[] = [
  ...NATIONWIDE_PROVINCES,
  {
    province: HCMC_PROVINCE,
    wards: HCMC_WARDS.map((name, index) => ({
      code: String(index + 1).padStart(3, "0"),
      name,
    })),
  },
];
