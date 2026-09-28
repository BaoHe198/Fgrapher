import { FilterSidebar } from "fgrapher";

const roleCounts = {
  PHOTOGRAPHER: 128,
  VIDEOGRAPHER: 46,
  MAKEUP_ARTIST: 73,
  STUDIO: 21,
  MODEL: 58,
  COSTUME_SHOP: 12,
  CAMERA_SHOP: 9,
};

const categoryCounts = {
  WEDDING: 94,
  PORTRAIT: 81,
  FASHION: 37,
  EVENT: 42,
  BRIDAL: 55,
  COMMERCIAL: 29,
  PRODUCT: 18,
  AO_DAI: 11,
  INDOOR: 16,
  MUSIC_VIDEO: 0,
};

export const Default = () => (
  <div className="w-[280px]">
    <FilterSidebar
      roleCounts={roleCounts}
      categoryCounts={categoryCounts}
      marketplaceEnabled
    />
  </div>
);

export const SparseProvince = () => (
  <div className="w-[280px]">
    <FilterSidebar
      roleCounts={{ PHOTOGRAPHER: 6, MAKEUP_ARTIST: 3, STUDIO: 1 }}
      categoryCounts={{ WEDDING: 5, PORTRAIT: 4, BRIDAL: 3, INDOOR: 1 }}
      marketplaceEnabled={false}
    />
  </div>
);
