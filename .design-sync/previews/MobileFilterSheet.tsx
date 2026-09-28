import { MobileFilterSheet } from "fgrapher";

const roleCounts = {
  PHOTOGRAPHER: 128,
  VIDEOGRAPHER: 46,
  MAKEUP_ARTIST: 73,
  STUDIO: 21,
  MODEL: 58,
  COSTUME_SHOP: 12,
};

const categoryCounts = { WEDDING: 94, PORTRAIT: 81, BRIDAL: 55, EVENT: 42 };

export const NoActiveFilters = () => (
  <MobileFilterSheet
    roleCounts={roleCounts}
    categoryCounts={categoryCounts}
    activeCount={0}
    resultCount={338}
    marketplaceEnabled
  />
);

export const ThreeActiveFilters = () => (
  <MobileFilterSheet
    roleCounts={roleCounts}
    categoryCounts={categoryCounts}
    activeCount={3}
    resultCount={24}
    marketplaceEnabled
  />
);
