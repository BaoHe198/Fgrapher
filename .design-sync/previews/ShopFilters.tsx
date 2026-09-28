import { ShopFilters } from "fgrapher";

const provinces = [
  { id: "p-hcm", name: "Thành phố Hồ Chí Minh" },
  { id: "p-hn", name: "Hà Nội" },
  { id: "p-dn", name: "Đà Nẵng" },
  { id: "p-ct", name: "Cần Thơ" },
  { id: "p-hp", name: "Hải Phòng" },
  { id: "p-kh", name: "Khánh Hòa" },
];

export const Default = () => (
  <div className="w-[280px]">
    <ShopFilters
      categoryCounts={{
        "Camera body": 34,
        Lens: 57,
        Lighting: 22,
        Audio: 9,
        Support: 14,
        Accessory: 31,
        Other: 4,
      }}
      provinces={provinces}
    />
  </div>
);

export const NewMarket = () => (
  <div className="w-[280px]">
    <ShopFilters
      categoryCounts={{ "Camera body": 3, Lens: 5 }}
      provinces={provinces.slice(0, 2)}
    />
  </div>
);
