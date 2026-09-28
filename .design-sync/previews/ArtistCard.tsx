import { ArtistCard } from "fgrapher";

// Brand-palette gradients stand in for portfolio photos: previews render
// offline, so remote images would come up empty.
const photo = (from: string, to: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='750'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='600' height='750' fill='url(#g)'/><text x='40' y='700' font-family='sans-serif' font-size='28' fill='rgba(255,255,255,0.7)'>${label}</text></svg>`,
  )}`;

const media = [
  { url: photo("#0f3d33", "#c9a24d", "Ảnh cưới Đà Lạt"), type: "IMAGE" },
  { url: photo("#3b2a1a", "#e8d3a8", "Chân dung áo dài"), type: "IMAGE" },
  { url: photo("#1c2b36", "#8fb3c7", "Kỷ yếu"), type: "IMAGE" },
];

export const Photographer = () => (
  <div className="w-[300px]">
    <ArtistCard
      artist={{
        id: "a1",
        name: "Minh Anh Nhiếp Ảnh",
        username: "minhanh",
        roles: ["Nhiếp ảnh gia"],
        city: "Phường Thủ Đức, Thành phố Hồ Chí Minh",
        rating: "5.0",
        reviews: 12,
        price: "Từ 2.000.000₫",
        media,
      }}
    />
  </div>
);

export const NewMultiRole = () => (
  <div className="w-[300px]">
    <ArtistCard
      artist={{
        id: "a2",
        name: "Ngọc Linh",
        username: "ngoclinh",
        roles: ["Người mẫu", "Nhiếp ảnh gia", "Chuyên viên trang điểm"],
        city: "Phường An Phú, Thành phố Hồ Chí Minh",
        rating: "Mới",
        reviews: 0,
        price: "Liên hệ để báo giá",
        media: media.slice(1),
        nationwideLabel: "Nhận việc toàn quốc",
      }}
    />
  </div>
);
